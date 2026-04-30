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
    public async Task<ReservationResponseDto> CreateAsync(CreateReservationDto dto, int? userId, CancellationToken cancellationToken)
    {
        await businessHoursService.EnsureReservationTimeAllowedAsync(dto.ReservationDate, dto.ReservationTime, cancellationToken);

        if (userId.HasValue)
        {
            await EnsureCustomerExistsAsync(userId.Value, cancellationToken);
        }

        var reservation = new Reservation
        {
            UserId = userId,
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            ReservationDate = dto.ReservationDate,
            ReservationTime = dto.ReservationTime,
            GuestsCount = dto.GuestsCount,
            CustomerNotes = dto.CustomerNotes?.Trim(),
            Status = ReservationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        db.Reservations.Add(reservation);
        await db.SaveChangesAsync(cancellationToken);
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
        var query = db.Reservations.AsNoTracking().AsQueryable();
        if (date.HasValue) query = query.Where(x => x.ReservationDate == date.Value);
        if (from.HasValue) query = query.Where(x => x.ReservationDate >= from.Value);
        if (to.HasValue) query = query.Where(x => x.ReservationDate <= to.Value);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(phoneNumber)) query = query.Where(x => x.PhoneNumber.Contains(phoneNumber.Trim()));
        return await query.OrderBy(x => x.ReservationDate).ThenBy(x => x.ReservationTime).Select(x => x.ToReservationResponse()).ToArrayAsync(cancellationToken);
    }

    public async Task<ReservationResponseDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);
        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> UpdateAsync(int id, UpdateReservationDto dto, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);
        var oldValues = ReservationAuditSnapshot(reservation);
        reservation.FirstName = dto.FirstName.Trim();
        reservation.LastName = dto.LastName.Trim();
        reservation.PhoneNumber = dto.PhoneNumber.Trim();
        reservation.ReservationDate = dto.ReservationDate;
        reservation.ReservationTime = dto.ReservationTime;
        reservation.GuestsCount = dto.GuestsCount;
        reservation.CustomerNotes = dto.CustomerNotes?.Trim();
        reservation.RestaurantNotes = dto.RestaurantNotes?.Trim();
        await db.SaveChangesAsync(cancellationToken);
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Reservation, reservation.Id, AuditActions.Update, OldValues: oldValues, NewValues: ReservationAuditSnapshot(reservation)),
            cancellationToken);
        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> UpdateStatusAsync(int id, UpdateReservationStatusDto dto, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
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

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
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
            .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
            ?? throw new ApiException("הזמנת המקום לא נמצאה.", StatusCodes.Status404NotFound);

        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> CancelForCustomerAsync(int userId, int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations
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

    private static ReservationAuditValues ReservationAuditSnapshot(Reservation reservation) =>
        new(
            reservation.UserId,
            reservation.ReservationDate,
            reservation.ReservationTime,
            reservation.GuestsCount,
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
        int GuestsCount,
        string Status);
}
