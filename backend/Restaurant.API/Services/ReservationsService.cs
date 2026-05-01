using System.Data;
using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class ReservationsService(
    AppDbContext db,
    IBusinessHoursService businessHoursService,
    IAuditService audit,
    IRestaurantRealtimeNotifier realtimeNotifier,
    ILogger<ReservationsService> logger) : IReservationsService
{
    private const int DefaultReservationDurationMinutes = 120;
    private static readonly ReservationStatus[] CapacityBlockingStatuses =
    [
        ReservationStatus.Pending,
        ReservationStatus.Approved,
        ReservationStatus.Arrived
    ];

    public async Task<ReservationResponseDto> CreateAsync(CreateReservationDto dto, int? userId, CancellationToken cancellationToken)
    {
        await businessHoursService.EnsureReservationTimeAllowedAsync(dto.ReservationDate, dto.ReservationTime, cancellationToken);

        if (userId.HasValue)
        {
            await EnsureCustomerExistsAsync(userId.Value, cancellationToken);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var durationMinutes = NormalizeDuration(dto.DurationMinutes);
        var table = await FindAvailableTableForReservationAsync(dto.ReservationDate, dto.ReservationTime, durationMinutes, dto.GuestsCount, null, cancellationToken)
            ?? throw new ApiException("אין שולחן פנוי שמתאים לכמות הסועדים בזמן שנבחר.", StatusCodes.Status409Conflict);

        var reservation = new Reservation
        {
            UserId = userId,
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            ReservationDate = dto.ReservationDate,
            ReservationTime = dto.ReservationTime,
            DurationMinutes = durationMinutes,
            GuestsCount = dto.GuestsCount,
            TableId = table.Id,
            CustomerNotes = dto.CustomerNotes?.Trim(),
            Status = ReservationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        db.Reservations.Add(reservation);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        reservation.Table = table;
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Reservation, reservation.Id, AuditActions.Create, userId, NewValues: ReservationAuditSnapshot(reservation)),
            cancellationToken);
        logger.LogInformation("Reservation {ReservationId} created for {ReservationDate} at {ReservationTime}", reservation.Id, reservation.ReservationDate, reservation.ReservationTime);
        var response = reservation.ToReservationResponse();
        await realtimeNotifier.ReservationCreatedAsync(response, cancellationToken);
        return response;
    }

    public async Task<IReadOnlyCollection<ReservationResponseDto>> GetAllAsync(DateOnly? date, DateOnly? from, DateOnly? to, ReservationStatus? status, string? phoneNumber, CancellationToken cancellationToken)
    {
        var query = FilterReservations(db.Reservations.AsNoTracking().Include(x => x.Table), date, from, to, status, phoneNumber);
        return await query.OrderBy(x => x.ReservationDate).ThenBy(x => x.ReservationTime).Select(x => x.ToReservationResponse()).ToArrayAsync(cancellationToken);
    }

    public async Task<PagedResponseDto<ReservationResponseDto>> GetPagedAsync(DateOnly? date, DateOnly? from, DateOnly? to, ReservationStatus? status, string? phoneNumber, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = FilterReservations(db.Reservations.AsNoTracking().Include(x => x.Table), date, from, to, status, phoneNumber);
        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 1, 100);
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(x => x.ReservationDate)
            .ThenBy(x => x.ReservationTime)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => x.ToReservationResponse())
            .ToArrayAsync(cancellationToken);

        return new PagedResponseDto<ReservationResponseDto>(safePage, safePageSize, totalCount, items);
    }

    private static IQueryable<Reservation> FilterReservations(IQueryable<Reservation> query, DateOnly? date, DateOnly? from, DateOnly? to, ReservationStatus? status, string? phoneNumber)
    {
        if (date.HasValue) query = query.Where(x => x.ReservationDate == date.Value);
        if (from.HasValue) query = query.Where(x => x.ReservationDate >= from.Value);
        if (to.HasValue) query = query.Where(x => x.ReservationDate <= to.Value);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(phoneNumber)) query = query.Where(x => x.PhoneNumber.Contains(phoneNumber.Trim()));
        return query;
    }

    public async Task<ReservationResponseDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.AsNoTracking().Include(x => x.Table).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);
        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> UpdateAsync(int id, UpdateReservationDto dto, CancellationToken cancellationToken)
    {
        await businessHoursService.EnsureReservationTimeAllowedAsync(dto.ReservationDate, dto.ReservationTime, cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var reservation = await db.Reservations.Include(x => x.Table).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);
        var oldValues = ReservationAuditSnapshot(reservation);
        var durationMinutes = NormalizeDuration(dto.DurationMinutes);
        var table = await FindAvailableTableForReservationAsync(dto.ReservationDate, dto.ReservationTime, durationMinutes, dto.GuestsCount, id, cancellationToken)
            ?? throw new ApiException("אין שולחן פנוי שמתאים לכמות הסועדים בזמן שנבחר.", StatusCodes.Status409Conflict);

        reservation.FirstName = dto.FirstName.Trim();
        reservation.LastName = dto.LastName.Trim();
        reservation.PhoneNumber = dto.PhoneNumber.Trim();
        reservation.ReservationDate = dto.ReservationDate;
        reservation.ReservationTime = dto.ReservationTime;
        reservation.DurationMinutes = durationMinutes;
        reservation.GuestsCount = dto.GuestsCount;
        reservation.TableId = table.Id;
        reservation.CustomerNotes = dto.CustomerNotes?.Trim();
        reservation.RestaurantNotes = dto.RestaurantNotes?.Trim();
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        reservation.Table = table;
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Reservation, reservation.Id, AuditActions.Update, OldValues: oldValues, NewValues: ReservationAuditSnapshot(reservation)),
            cancellationToken);
        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> UpdateStatusAsync(int id, UpdateReservationStatusDto dto, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.Include(x => x.Table).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);
        var oldValues = ReservationAuditSnapshot(reservation);
        reservation.Status = dto.Status;
        reservation.RestaurantNotes = dto.RestaurantNotes?.Trim();
        await db.SaveChangesAsync(cancellationToken);
        await audit.TryLogAsync(
            new AuditLogEntry(
                AuditEntityTypes.Reservation,
                reservation.Id,
                ReservationStatusAction(reservation.Status),
                OldValues: oldValues,
                NewValues: ReservationAuditSnapshot(reservation)),
            cancellationToken);
        logger.LogInformation("Reservation {ReservationId} status updated to {Status}", reservation.Id, reservation.Status);
        var response = reservation.ToReservationResponse();
        await realtimeNotifier.ReservationStatusUpdatedAsync(response, cancellationToken);
        return response;
    }

    public Task<ReservationResponseDto> ApproveAsync(int id, string? restaurantNotes, CancellationToken cancellationToken) =>
        DecideReservationAsync(id, ReservationStatus.Approved, restaurantNotes, cancellationToken);

    public Task<ReservationResponseDto> RejectAsync(int id, string? restaurantNotes, CancellationToken cancellationToken) =>
        DecideReservationAsync(id, ReservationStatus.Rejected, restaurantNotes, cancellationToken);

    private async Task<ReservationResponseDto> DecideReservationAsync(int id, ReservationStatus status, string? restaurantNotes, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var reservation = await db.Reservations.Include(x => x.Table).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);

        var oldValues = ReservationAuditSnapshot(reservation);
        if (status == ReservationStatus.Approved && reservation.TableId is null)
        {
            var table = await FindAvailableTableForReservationAsync(
                reservation.ReservationDate,
                reservation.ReservationTime,
                reservation.DurationMinutes,
                reservation.GuestsCount,
                reservation.Id,
                cancellationToken)
                ?? throw new ApiException("אין שולחן פנוי שמתאים לכמות הסועדים בזמן שנבחר.", StatusCodes.Status409Conflict);
            reservation.TableId = table.Id;
            reservation.Table = table;
        }

        reservation.Status = status;
        reservation.RestaurantNotes = restaurantNotes?.Trim();
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await audit.TryLogAsync(
            new AuditLogEntry(
                AuditEntityTypes.Reservation,
                reservation.Id,
                ReservationStatusAction(status),
                OldValues: oldValues,
                NewValues: ReservationAuditSnapshot(reservation)),
            cancellationToken);

        var response = reservation.ToReservationResponse();
        await realtimeNotifier.ReservationStatusUpdatedAsync(response, cancellationToken);
        return response;
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.Include(x => x.Table).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);
        reservation.Status = ReservationStatus.Cancelled;
        reservation.RestaurantNotes = string.IsNullOrWhiteSpace(reservation.RestaurantNotes)
            ? "בוטל על ידי המסעדה."
            : reservation.RestaurantNotes;
        await db.SaveChangesAsync(cancellationToken);
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Reservation, reservation.Id, AuditActions.Cancelled, NewValues: ReservationAuditSnapshot(reservation)),
            cancellationToken);
        logger.LogInformation("Reservation {ReservationId} cancelled", reservation.Id);
        await realtimeNotifier.ReservationStatusUpdatedAsync(reservation.ToReservationResponse(), cancellationToken);
    }

    public async Task<IReadOnlyCollection<ReservationResponseDto>> GetForCustomerAsync(int userId, CancellationToken cancellationToken)
    {
        var reservations = await db.Reservations.AsNoTracking()
            .Include(x => x.Table)
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.ReservationDate)
            .ThenByDescending(x => x.ReservationTime)
            .Select(x => x.ToReservationResponse())
            .ToArrayAsync(cancellationToken);

        return reservations;
    }

    public async Task<ReservationResponseDto> GetForCustomerByIdAsync(int userId, int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.AsNoTracking()
            .Include(x => x.Table)
            .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);

        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> CancelForCustomerAsync(int userId, int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.Include(x => x.Table)
            .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);

        if (reservation.Status is not (ReservationStatus.Pending or ReservationStatus.Approved))
        {
            throw new ApiException("לא ניתן לבטל את הזמנת המקום במצב הנוכחי.", StatusCodes.Status409Conflict);
        }

        var oldValues = ReservationAuditSnapshot(reservation);
        reservation.Status = ReservationStatus.Cancelled;
        reservation.RestaurantNotes = string.IsNullOrWhiteSpace(reservation.RestaurantNotes)
            ? "בוטל על ידי הלקוח."
            : reservation.RestaurantNotes;
        await db.SaveChangesAsync(cancellationToken);
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Reservation, reservation.Id, AuditActions.Cancelled, userId, oldValues, ReservationAuditSnapshot(reservation)),
            cancellationToken);

        var response = reservation.ToReservationResponse();
        logger.LogInformation("Customer {UserId} cancelled reservation {ReservationId}", userId, reservation.Id);
        await realtimeNotifier.ReservationStatusUpdatedAsync(response, cancellationToken);
        return response;
    }

    private async Task EnsureCustomerExistsAsync(int userId, CancellationToken cancellationToken)
    {
        var exists = await db.Users.AsNoTracking()
            .AnyAsync(x => x.Id == userId && x.Role == UserRole.Customer, cancellationToken);

        if (!exists)
        {
            throw new ApiException("המשתמש לא נמצא.", StatusCodes.Status404NotFound);
        }
    }

    private async Task<Table?> FindAvailableTableForReservationAsync(
        DateOnly date,
        TimeOnly startTime,
        int durationMinutes,
        int guestsCount,
        int? excludeReservationId,
        CancellationToken cancellationToken)
    {
        var candidates = await TablesForReservationCapacity(guestsCount)
            .OrderBy(x => x.Capacity)
            .ThenBy(x => x.Name)
            .ToArrayAsync(cancellationToken);

        if (candidates.Length == 0)
        {
            return null;
        }

        var candidateIds = candidates.Select(x => x.Id).ToArray();
        var blockingReservations = await db.Reservations.AsNoTracking()
            .Where(x =>
                x.TableId.HasValue &&
                candidateIds.Contains(x.TableId.Value) &&
                x.ReservationDate == date &&
                CapacityBlockingStatuses.Contains(x.Status) &&
                (!excludeReservationId.HasValue || x.Id != excludeReservationId.Value))
            .Select(x => new ReservationWindow(x.TableId!.Value, x.ReservationTime, x.DurationMinutes))
            .ToArrayAsync(cancellationToken);

        return candidates.FirstOrDefault(table =>
            !blockingReservations.Any(reservation =>
                reservation.TableId == table.Id &&
                TimeWindowsOverlap(startTime, durationMinutes, reservation.StartTime, reservation.DurationMinutes)));
    }

    private IQueryable<Table> TablesForReservationCapacity(int guestsCount) =>
        IsSqlServer()
            ? db.Tables.FromSqlInterpolated($"SELECT * FROM [Tables] WITH (UPDLOCK, HOLDLOCK) WHERE [Capacity] >= {guestsCount}")
            : db.Tables.Where(x => x.Capacity >= guestsCount);

    private static bool TimeWindowsOverlap(TimeOnly leftStart, int leftDurationMinutes, TimeOnly rightStart, int rightDurationMinutes)
    {
        var leftStartMinutes = leftStart.Hour * 60 + leftStart.Minute;
        var leftEndMinutes = leftStartMinutes + leftDurationMinutes;
        var rightStartMinutes = rightStart.Hour * 60 + rightStart.Minute;
        var rightEndMinutes = rightStartMinutes + rightDurationMinutes;

        return leftStartMinutes < rightEndMinutes && leftEndMinutes > rightStartMinutes;
    }

    private static int NormalizeDuration(int? durationMinutes) =>
        durationMinutes is > 0 ? durationMinutes.Value : DefaultReservationDurationMinutes;

    private bool IsSqlServer() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.SqlServer", StringComparison.Ordinal);

    private static ReservationAuditValues ReservationAuditSnapshot(Reservation reservation) =>
        new(
            reservation.UserId,
            reservation.ReservationDate,
            reservation.ReservationTime,
            reservation.DurationMinutes,
            reservation.GuestsCount,
            reservation.TableId,
            reservation.Status.ToString());

    private static string ReservationStatusAction(ReservationStatus status) =>
        status switch
        {
            ReservationStatus.Approved => AuditActions.Approved,
            ReservationStatus.Rejected => AuditActions.Rejected,
            ReservationStatus.Cancelled => AuditActions.Cancelled,
            _ => AuditActions.StatusChange
        };

    private sealed record ReservationAuditValues(
        int? UserId,
        DateOnly ReservationDate,
        TimeOnly ReservationTime,
        int DurationMinutes,
        int GuestsCount,
        int? TableId,
        string Status);

    private sealed record ReservationWindow(int TableId, TimeOnly StartTime, int DurationMinutes);
}
