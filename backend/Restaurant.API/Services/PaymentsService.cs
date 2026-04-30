using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class PaymentsService(
    AppDbContext db,
    IOrderStateService orderState,
    IOrderTableAssignmentService tableAssignments,
    IRestaurantRealtimeNotifier realtimeNotifier,
    ILogger<PaymentsService> logger) : IPaymentsService
{
    public async Task<CreatePaymentResponseDto> CreateAsync(int createdByUserId, CreatePaymentDto dto, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(createdByUserId, dto);
        EnsureIdempotencyKey(dto, createdByUserId);

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var existingPayment = await LoadExistingPaymentForUpdateAsync(dto.IdempotencyKey, cancellationToken);
            if (existingPayment is not null)
            {
                EnsureIdempotencyReplayMatches(existingPayment, dto, createdByUserId);

                var existingResult = await BuildPaymentResultAsync(existingPayment, cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                logger.LogInformation(
                    "Idempotent payment replay for order {OrderId}, payment {PaymentId}, idempotency key {IdempotencyKey}",
                    existingPayment.OrderId,
                    existingPayment.Id,
                    dto.IdempotencyKey);

                return existingResult;
            }

            var amount = ValidateAndNormalizeAmount(dto, createdByUserId);
            EnsureValidMethod(dto, createdByUserId);

            var order = await LoadOrderForPaymentAsync(dto.OrderId, cancellationToken)
                ?? throw RejectPayment(dto, createdByUserId, "OrderNotFound", "ההזמנה לא נמצאה.", StatusCodes.Status404NotFound);

            EnsurePaymentAllowed(order, dto, createdByUserId);

            var totalAmount = NormalizeMoney(order.TotalAmount);
            var paidBeforePayment = NormalizeMoney(order.Payments.Sum(x => x.Amount));
            var remainingBeforePayment = RemainingAmount(totalAmount, paidBeforePayment);

            if (remainingBeforePayment <= 0)
            {
                throw RejectPayment(dto, createdByUserId, "NoRemainingBalance", "ההזמנה כבר שולמה במלואה.", StatusCodes.Status400BadRequest);
            }

            if (amount > remainingBeforePayment)
            {
                throw RejectPayment(
                    dto,
                    createdByUserId,
                    "Overpayment",
                    $"סכום התשלום גבוה מהיתרה שנותרה: {remainingBeforePayment:0.00}.",
                    StatusCodes.Status400BadRequest);
            }

            var now = DateTime.UtcNow;
            var payment = new Payment
            {
                OrderId = dto.OrderId,
                IdempotencyKey = dto.IdempotencyKey,
                Amount = amount,
                Method = dto.Method,
                CreatedAt = now,
                CreatedByUserId = createdByUserId
            };

            order.Payments.Add(payment);

            var paidAfterPayment = NormalizeMoney(paidBeforePayment + amount);
            order.TotalAmount = totalAmount;
            var completed = orderState.ApplyPaymentStatus(order, totalAmount, paidAfterPayment, createdByUserId, now);
            if (completed)
            {
                await tableAssignments.ReleaseTablesForClosedOrderAsync(order, cancellationToken);
            }

            // Force an Orders row update for every payment, even when status values do not change.
            // Together with the serializable transaction and UPDLOCK, this serializes all payments per order.
            db.Entry(order).Property(x => x.PaymentStatus).IsModified = true;
            db.Entry(order).Property(x => x.Status).IsModified = true;
            db.Entry(order).Property(x => x.KitchenStatus).IsModified = true;
            db.Entry(order).Property(x => x.TotalAmount).IsModified = true;

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var result = new CreatePaymentResponseDto(
                payment.ToPaymentResponse(),
                order.Id,
                order.Status,
                order.KitchenStatus,
                order.PaymentStatus,
                totalAmount,
                paidAfterPayment,
                RemainingAmount(totalAmount, paidAfterPayment));

            logger.LogInformation(
                "Payment {PaymentId} created for order {OrderId} by user {UserId}. Amount {Amount}, method {Method}, idempotency key {IdempotencyKey}, status {PaymentStatus}, remaining {RemainingAmount}",
                payment.Id,
                order.Id,
                createdByUserId,
                amount,
                payment.Method,
                payment.IdempotencyKey,
                result.PaymentStatus,
                result.RemainingAmount);

            await NotifyPaymentAddedAsync(result, CustomerUserId(order), cancellationToken);

            return result;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Payment concurrency conflict for order {OrderId}, idempotency key {IdempotencyKey}", dto.OrderId, dto.IdempotencyKey);
            throw new ApiException("ההזמנה עודכנה במקביל. רעננו את היתרה ונסו שוב.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogInformation(exception, "Duplicate idempotency key {IdempotencyKey} detected while creating payment for order {OrderId}", dto.IdempotencyKey, dto.OrderId);

            var existingPayment = await LoadExistingPaymentAsync(dto.IdempotencyKey, cancellationToken);
            if (existingPayment is not null)
            {
                EnsureIdempotencyReplayMatches(existingPayment, dto, createdByUserId);
                return await BuildPaymentResultAsync(existingPayment, cancellationToken);
            }

            throw new ApiException("בקשת התשלום כבר עובדה. רעננו את ההזמנה ונסו שוב.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Payment SQL concurrency conflict for order {OrderId}, idempotency key {IdempotencyKey}", dto.OrderId, dto.IdempotencyKey);
            throw new ApiException("ההזמנה עודכנה במקביל. רעננו את היתרה ונסו שוב.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyCollection<PaymentResponseDto>> GetAllAsync(
        DateOnly? date,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken cancellationToken)
    {
        var query = db.Payments.AsNoTracking();

        if (from.HasValue)
        {
            var fromUtc = from.Value.UtcDateTime;
            query = query.Where(x => x.CreatedAt >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = to.Value.UtcDateTime;
            query = query.Where(x => x.CreatedAt < toUtc);
        }

        if (!from.HasValue && !to.HasValue && date.HasValue)
        {
            var start = date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = start.AddDays(1);
            query = query.Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        }

        return await query
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => x.ToPaymentResponse())
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<PaymentResponseDto>> GetByOrderAsync(int orderId, CancellationToken cancellationToken)
    {
        if (!await db.Orders.AnyAsync(x => x.Id == orderId, cancellationToken))
        {
            throw new ApiException("ההזמנה לא נמצאה.", StatusCodes.Status404NotFound);
        }

        return await db.Payments.AsNoTracking()
            .Where(x => x.OrderId == orderId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => x.ToPaymentResponse())
            .ToArrayAsync(cancellationToken);
    }

    private async Task<Payment?> LoadExistingPaymentForUpdateAsync(Guid idempotencyKey, CancellationToken cancellationToken) =>
        await PaymentsForUpdate(idempotencyKey)
            .SingleOrDefaultAsync(cancellationToken);

    private async Task<Order?> LoadOrderForPaymentAsync(int orderId, CancellationToken cancellationToken) =>
        await OrdersForUpdate(orderId)
            .Include(x => x.Payments)
            .Include(x => x.OrderTables)
            .Include(x => x.StatusChanges)
            .Include(x => x.User)
            .SingleOrDefaultAsync(cancellationToken);

    private IQueryable<Payment> PaymentsForUpdate(Guid idempotencyKey) =>
        IsSqlServer()
            ? db.Payments.FromSqlInterpolated($"SELECT * FROM [Payments] WITH (UPDLOCK, HOLDLOCK) WHERE [IdempotencyKey] = {idempotencyKey}")
            : db.Payments.Where(x => x.IdempotencyKey == idempotencyKey);

    private IQueryable<Order> OrdersForUpdate(int orderId) =>
        IsSqlServer()
            ? db.Orders.FromSqlInterpolated($"SELECT * FROM [Orders] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {orderId}")
            : db.Orders.Where(x => x.Id == orderId);

    private async Task<Payment?> LoadExistingPaymentAsync(Guid idempotencyKey, CancellationToken cancellationToken) =>
        await db.Payments.AsNoTracking()
            .SingleOrDefaultAsync(x => x.IdempotencyKey == idempotencyKey, cancellationToken);

    private async Task<CreatePaymentResponseDto> BuildPaymentResultAsync(Payment payment, CancellationToken cancellationToken)
    {
        var order = await db.Orders.AsNoTracking()
            .SingleAsync(x => x.Id == payment.OrderId, cancellationToken);
        var paidAmount = await SumPaymentsAsync(payment.OrderId, cancellationToken);
        var totalAmount = NormalizeMoney(order.TotalAmount);

        return new CreatePaymentResponseDto(
            payment.ToPaymentResponse(),
            order.Id,
            order.Status,
            order.KitchenStatus,
            order.PaymentStatus,
            totalAmount,
            paidAmount,
            RemainingAmount(totalAmount, paidAmount));
    }

    private async Task<decimal> SumPaymentsAsync(int orderId, CancellationToken cancellationToken)
    {
        var query = db.Payments.AsNoTracking()
            .Where(x => x.OrderId == orderId);

        if (IsSqlite())
        {
            var amounts = await query.Select(x => x.Amount).ToArrayAsync(cancellationToken);
            return NormalizeMoney(amounts.Sum());
        }

        return NormalizeMoney(await query.SumAsync(x => x.Amount, cancellationToken));
    }

    private void EnsureAuthenticatedUser(int createdByUserId, CreatePaymentDto dto)
    {
        if (createdByUserId <= 0)
        {
            throw RejectPayment(dto, createdByUserId, "UnauthenticatedUser", "המשתמש לא מזוהה.", StatusCodes.Status401Unauthorized);
        }
    }

    private void EnsureIdempotencyKey(CreatePaymentDto dto, int createdByUserId)
    {
        if (dto.IdempotencyKey == Guid.Empty)
        {
            throw RejectPayment(dto, createdByUserId, "MissingIdempotencyKey", "מפתח הבקשה לתשלום אינו תקין.", StatusCodes.Status400BadRequest);
        }
    }

    private void EnsureIdempotencyReplayMatches(Payment existingPayment, CreatePaymentDto dto, int createdByUserId)
    {
        if (existingPayment.OrderId == dto.OrderId &&
            NormalizeMoney(existingPayment.Amount) == NormalizeMoney(dto.Amount) &&
            existingPayment.Method == dto.Method)
        {
            return;
        }

        throw RejectPayment(
            dto,
            createdByUserId,
            "IdempotencyKeyPayloadMismatch",
            "Payment idempotency key was already used for a different payment request.",
            StatusCodes.Status409Conflict);
    }

    private decimal ValidateAndNormalizeAmount(CreatePaymentDto dto, int createdByUserId)
    {
        var amount = NormalizeMoney(dto.Amount);
        if (amount <= 0)
        {
            throw RejectPayment(dto, createdByUserId, "InvalidAmount", "סכום התשלום חייב להיות לפחות 0.01.", StatusCodes.Status400BadRequest);
        }

        return amount;
    }

    private void EnsureValidMethod(CreatePaymentDto dto, int createdByUserId)
    {
        if (!Enum.IsDefined(dto.Method))
        {
            throw RejectPayment(dto, createdByUserId, "InvalidPaymentMethod", "אמצעי התשלום אינו תקין.", StatusCodes.Status400BadRequest);
        }
    }

    private void EnsurePaymentAllowed(Order order, CreatePaymentDto dto, int createdByUserId)
    {
        if (order.Status != OrderStatus.Open)
        {
            throw RejectPayment(dto, createdByUserId, "OrderNotOpen", "Cannot add payment to a completed or cancelled order.", StatusCodes.Status400BadRequest);
        }

        if (order.PaymentStatus is PaymentStatus.Paid or PaymentStatus.Refunded)
        {
            throw RejectPayment(dto, createdByUserId, "OrderAlreadyPaid", "ההזמנה כבר שולמה במלואה.", StatusCodes.Status400BadRequest);
        }
    }

    private ApiException RejectPayment(CreatePaymentDto dto, int createdByUserId, string reason, string message, int statusCode)
    {
        logger.LogWarning(
            "Payment rejected for order {OrderId} by user {UserId}. Reason {Reason}, amount {Amount}, method {Method}, idempotency key {IdempotencyKey}",
            dto.OrderId,
            createdByUserId,
            reason,
            dto.Amount,
            dto.Method,
            dto.IdempotencyKey);

        return new ApiException(message, statusCode);
    }

    private async Task RollbackQuietlyAsync(IDbContextTransaction transaction, CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Failed to roll back payment transaction");
        }
    }

    private async Task NotifyPaymentAddedAsync(CreatePaymentResponseDto result, int? customerUserId, CancellationToken cancellationToken)
    {
        try
        {
            await realtimeNotifier.PaymentAddedAsync(result, customerUserId, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Payment {PaymentId} for order {OrderId} was committed but realtime notification failed",
                result.Payment.Id,
                result.OrderId);
        }
    }

    private static int? CustomerUserId(Order order) =>
        order.User?.Role == UserRole.Customer ? order.UserId : null;

    private static decimal NormalizeMoney(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static decimal RemainingAmount(decimal totalAmount, decimal paidAmount) =>
        Math.Max(NormalizeMoney(totalAmount) - NormalizeMoney(paidAmount), 0);

    private static bool IsUniqueConstraintViolation(DbUpdateException exception) =>
        exception.InnerException is SqlException sqlException &&
        sqlException.Errors.Cast<SqlError>().Any(error => error.Number is 2601 or 2627);

    private static bool IsSqlConcurrencyFailure(DbUpdateException exception) =>
        exception.InnerException is SqlException sqlException &&
        sqlException.Errors.Cast<SqlError>().Any(error => error.Number == 1205);

    private bool IsSqlServer() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.SqlServer", StringComparison.Ordinal);

    private bool IsSqlite() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.Sqlite", StringComparison.Ordinal);
}
