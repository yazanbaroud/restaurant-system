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

public sealed class OrdersService(
    AppDbContext db,
    IOrderTableAssignmentService tableAssignments,
    IOrderStateService orderState,
    IRestaurantRealtimeNotifier realtimeNotifier,
    ILogger<OrdersService> logger) : IOrdersService
{
    public async Task<OrderResponseDto> CreateAsync(int createdByUserId, CreateOrderDto dto, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(createdByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var menuItems = await LoadMenuItemsAsync(dto.Items.Select(x => x.MenuItemId), cancellationToken);
            var now = DateTime.UtcNow;
            var order = new Order
            {
                UserId = createdByUserId,
                CustomerFirstName = dto.CustomerFirstName?.Trim() ?? string.Empty,
                CustomerLastName = dto.CustomerLastName?.Trim() ?? string.Empty,
                Notes = dto.Notes?.Trim(),
                CreatedAt = now,
                OrderNumber = OrderNumberGenerator.Create(now),
                OrderType = dto.OrderType
            };

            orderState.Initialize(order, createdByUserId, now);
            AddItems(order, dto.Items, menuItems);
            await tableAssignments.AssignTablesForNewOrderAsync(order, dto.OrderType, dto.TableIds, cancellationToken);
            RecalculateTotal(order);

            db.Orders.Add(order);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await ReloadOrderAsync(order, cancellationToken);
            logger.LogInformation("Order created with id {OrderId} and number {OrderNumber} by user {UserId}", order.Id, order.OrderNumber, createdByUserId);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderCreatedAsync(response, CustomerUserId(order), cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order creation concurrency conflict by user {UserId}", createdByUserId);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order creation SQL concurrency conflict by user {UserId}", createdByUserId);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyCollection<OrderResponseDto>> GetAllAsync(
        OrderStatus? status,
        KitchenStatus? kitchenStatus,
        DateOnly? date,
        DateOnly? from,
        DateOnly? to,
        PaymentStatus? paymentStatus,
        OrderType? orderType,
        bool activeOnly,
        CancellationToken cancellationToken)
    {
        var query = IncludeOrderGraph(db.Orders.AsNoTracking());
        if (activeOnly) query = query.Where(x => x.Status == OrderStatus.Open);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (kitchenStatus.HasValue) query = query.Where(x => x.KitchenStatus == kitchenStatus.Value);
        if (paymentStatus.HasValue) query = query.Where(x => x.PaymentStatus == paymentStatus.Value);
        if (orderType.HasValue) query = query.Where(x => x.OrderType == orderType.Value);
        if (date.HasValue)
        {
            var start = date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = start.AddDays(1);
            query = query.Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        }

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            throw new ApiException("Start date must be before or equal to end date.");
        }

        if (from.HasValue)
        {
            var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(x => x.CreatedAt >= start);
        }

        if (to.HasValue)
        {
            var end = to.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(1);
            query = query.Where(x => x.CreatedAt < end);
        }

        var orders = await query.OrderByDescending(x => x.CreatedAt).ToArrayAsync(cancellationToken);
        return orders.Select(x => x.ToOrderResponse()).ToArray();
    }

    public async Task<OrderResponseDto> GetByIdAsync(int id, bool activeOnly, CancellationToken cancellationToken)
    {
        var query = IncludeOrderGraph(db.Orders.AsNoTracking());
        if (activeOnly) query = query.Where(x => x.Status == OrderStatus.Open);

        var order = await query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);
        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> UpdateAsync(int id, UpdateOrderDto dto, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            orderState.EnsureItemsCanBeChanged(order);
            var tableIds = dto.OrderType == OrderType.TakeAway
                ? Array.Empty<int>()
                : order.OrderTables.Select(x => x.TableId).ToArray();

            await tableAssignments.ReplaceTablesAsync(order, dto.OrderType, tableIds, cancellationToken);
            order.CustomerFirstName = dto.CustomerFirstName?.Trim() ?? string.Empty;
            order.CustomerLastName = dto.CustomerLastName?.Trim() ?? string.Empty;
            order.Notes = dto.Notes?.Trim();
            order.OrderType = dto.OrderType;

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);
            return order.ToOrderResponse();
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} update concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} update SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<OrderResponseDto> AdvanceKitchenStatusAsync(int id, int changedByUserId, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(changedByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            var completed = orderState.AdvanceKitchenStatus(order, changedByUserId, DateTime.UtcNow);
            if (completed)
            {
                await tableAssignments.ReleaseTablesForClosedOrderAsync(order, cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            logger.LogInformation("Order {OrderId} kitchen status advanced to {KitchenStatus}", order.Id, order.KitchenStatus);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderStatusUpdatedAsync(response, CustomerUserId(order), cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} kitchen status concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} kitchen status SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<OrderResponseDto> MarkPaidAsync(int id, int changedByUserId, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(changedByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            var paidAmount = await db.Payments.Where(x => x.OrderId == id).SumAsync(x => x.Amount, cancellationToken);
            var completed = orderState.MarkPaidFromExistingPayments(order, paidAmount, changedByUserId, DateTime.UtcNow);
            if (completed)
            {
                await tableAssignments.ReleaseTablesForClosedOrderAsync(order, cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderStatusUpdatedAsync(response, CustomerUserId(order), cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} mark-paid concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} mark-paid SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<OrderResponseDto> CancelAsync(int id, int changedByUserId, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(changedByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            orderState.Cancel(order, changedByUserId, DateTime.UtcNow);
            await tableAssignments.ReleaseTablesForClosedOrderAsync(order, cancellationToken);

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            logger.LogInformation("Order {OrderId} cancelled by user {UserId}", order.Id, changedByUserId);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderStatusUpdatedAsync(response, CustomerUserId(order), cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} cancellation concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} cancellation SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public Task<OrderResponseDto> AddItemAsync(int id, AddOrderItemDto dto, CancellationToken cancellationToken) =>
        MutateOrderItemsAsync(
            id,
            async (order, token) =>
            {
                var menuItem = await LoadAvailableMenuItemAsync(dto.MenuItemId, token);
                order.Items.Add(new OrderItem
                {
                    MenuItemId = menuItem.Id,
                    Quantity = dto.Quantity,
                    UnitPrice = menuItem.Price,
                    Notes = dto.Notes?.Trim()
                });
            },
            "item add",
            cancellationToken);

    public Task<OrderResponseDto> UpdateItemAsync(int id, int itemId, UpdateOrderItemDto dto, CancellationToken cancellationToken) =>
        MutateOrderItemsAsync(
            id,
            (order, _) =>
            {
                var item = order.Items.SingleOrDefault(x => x.Id == itemId)
                    ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);
                item.Quantity = dto.Quantity;
                item.Notes = dto.Notes?.Trim();
                return Task.CompletedTask;
            },
            "item update",
            cancellationToken);

    public Task<OrderResponseDto> DeleteItemAsync(int id, int itemId, CancellationToken cancellationToken) =>
        MutateOrderItemsAsync(
            id,
            (order, _) =>
            {
                var item = order.Items.SingleOrDefault(x => x.Id == itemId)
                    ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);

                if (order.Items.Count <= 1)
                {
                    throw new ApiException("Order must include at least one item.");
                }

                order.Items.Remove(item);
                return Task.CompletedTask;
            },
            "item delete",
            cancellationToken);

    public async Task<OrderResponseDto> UpdateTablesAsync(int id, UpdateOrderTablesDto dto, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            orderState.EnsureItemsCanBeChanged(order);
            await tableAssignments.ReplaceTablesAsync(order, order.OrderType, dto.TableIds, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);
            return order.ToOrderResponse();
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} table update concurrency conflict", id);
            throw new ApiException("Order tables were updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} table update SQL concurrency conflict", id);
            throw new ApiException("Order tables were updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    private static IQueryable<Order> IncludeOrderGraph(IQueryable<Order> query) =>
        query.Include(x => x.Items).ThenInclude(x => x.MenuItem)
            .Include(x => x.OrderTables).ThenInclude(x => x.Table)
            .Include(x => x.StatusChanges)
            .Include(x => x.User);

    private async Task<Order> LoadTrackedOrderAsync(int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(db.Orders).Include(x => x.Payments).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private async Task<Order> LoadTrackedOrderForUpdateAsync(int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(db.Orders
                .FromSqlInterpolated($"SELECT * FROM [Orders] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}"))
            .Include(x => x.Payments)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private async Task<OrderResponseDto> MutateOrderItemsAsync(
        int id,
        Func<Order, CancellationToken, Task> mutate,
        string operation,
        CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            orderState.EnsureItemsCanBeChanged(order);
            await mutate(order, cancellationToken);
            RecalculateTotal(order);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);
            return order.ToOrderResponse();
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} {Operation} concurrency conflict", id, operation);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} {Operation} SQL concurrency conflict", id, operation);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task ReloadOrderAsync(Order order, CancellationToken cancellationToken)
    {
        await db.Entry(order).Collection(x => x.Items).Query().Include(x => x.MenuItem).LoadAsync(cancellationToken);
        await db.Entry(order).Collection(x => x.OrderTables).Query().Include(x => x.Table).LoadAsync(cancellationToken);
        await db.Entry(order).Collection(x => x.StatusChanges).LoadAsync(cancellationToken);
        await db.Entry(order).Reference(x => x.User).LoadAsync(cancellationToken);
    }

    private async Task<Dictionary<int, MenuItem>> LoadMenuItemsAsync(IEnumerable<int> ids, CancellationToken cancellationToken)
    {
        var distinctIds = ids.Distinct().ToArray();
        var activeCategoryIds = await db.MenuCategories.AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => x.Id)
            .ToArrayAsync(cancellationToken);
        var activeCategorySet = activeCategoryIds.ToHashSet();
        var items = await db.MenuItems
            .Where(x => distinctIds.Contains(x.Id) && x.IsAvailable)
            .ToArrayAsync(cancellationToken);
        var availableItems = items.Where(x => activeCategorySet.Contains(x.Category)).ToDictionary(x => x.Id);
        if (availableItems.Count != distinctIds.Length)
        {
            throw new ApiException("One or more menu items were not found or are unavailable.");
        }

        return availableItems;
    }

    private async Task<MenuItem> LoadAvailableMenuItemAsync(int id, CancellationToken cancellationToken) =>
        (await LoadMenuItemsAsync([id], cancellationToken))[id];

    private static void AddItems(Order order, IEnumerable<CreateOrderItemDto> items, IReadOnlyDictionary<int, MenuItem> menuItems)
    {
        foreach (var item in items)
        {
            var menuItem = menuItems[item.MenuItemId];
            order.Items.Add(new OrderItem
            {
                MenuItemId = item.MenuItemId,
                Quantity = item.Quantity,
                UnitPrice = menuItem.Price,
                Notes = item.Notes?.Trim()
            });
        }
    }

    private static int? CustomerUserId(Order order) =>
        order.User?.Role == UserRole.Customer ? order.UserId : null;

    private static void EnsureAuthenticatedUser(int userId)
    {
        if (userId <= 0)
        {
            throw new ApiException("Authenticated user was not found.", StatusCodes.Status401Unauthorized);
        }
    }

    private async Task RollbackQuietlyAsync(IDbContextTransaction transaction, CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Failed to roll back order transaction");
        }
    }

    private static void RecalculateTotal(Order order) =>
        order.TotalAmount = order.Items.Sum(x => x.UnitPrice * x.Quantity);

    private static bool IsSqlConcurrencyFailure(DbUpdateException exception) =>
        exception.InnerException is SqlException sqlException &&
        sqlException.Errors.Cast<SqlError>().Any(error => error.Number == 1205);
}
