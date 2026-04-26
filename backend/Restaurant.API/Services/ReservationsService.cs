using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Hubs;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class ReservationsService(
    AppDbContext db,
    IHubContext<RestaurantHub> hub,
    ILogger<ReservationsService> logger) : IReservationsService
{
    public async Task<ReservationResponseDto> CreateAsync(CreateReservationDto dto, CancellationToken cancellationToken)
    {
        var reservation = new Reservation
        {
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
        logger.LogInformation("Reservation {ReservationId} created for {ReservationDate} at {ReservationTime}", reservation.Id, reservation.ReservationDate, reservation.ReservationTime);
        var response = reservation.ToReservationResponse();
        await hub.Clients.All.SendAsync("reservationCreated", response, cancellationToken);
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
            ?? throw new ApiException("Reservation not found.", StatusCodes.Status404NotFound);
        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> UpdateAsync(int id, UpdateReservationDto dto, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Reservation not found.", StatusCodes.Status404NotFound);
        reservation.FirstName = dto.FirstName.Trim();
        reservation.LastName = dto.LastName.Trim();
        reservation.PhoneNumber = dto.PhoneNumber.Trim();
        reservation.ReservationDate = dto.ReservationDate;
        reservation.ReservationTime = dto.ReservationTime;
        reservation.GuestsCount = dto.GuestsCount;
        reservation.CustomerNotes = dto.CustomerNotes?.Trim();
        reservation.RestaurantNotes = dto.RestaurantNotes?.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return reservation.ToReservationResponse();
    }

    public async Task<ReservationResponseDto> UpdateStatusAsync(int id, UpdateReservationStatusDto dto, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Reservation not found.", StatusCodes.Status404NotFound);
        reservation.Status = dto.Status;
        reservation.RestaurantNotes = dto.RestaurantNotes?.Trim();
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Reservation {ReservationId} status updated to {Status}", reservation.Id, reservation.Status);
        var response = reservation.ToReservationResponse();
        await hub.Clients.All.SendAsync("reservationStatusUpdated", response, cancellationToken);
        return response;
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Reservation not found.", StatusCodes.Status404NotFound);
        reservation.Status = ReservationStatus.Cancelled;
        reservation.RestaurantNotes = string.IsNullOrWhiteSpace(reservation.RestaurantNotes)
            ? "Reservation cancelled by restaurant."
            : reservation.RestaurantNotes;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Reservation {ReservationId} cancelled", reservation.Id);
        await hub.Clients.All.SendAsync("reservationStatusUpdated", reservation.ToReservationResponse(), cancellationToken);
    }
}
