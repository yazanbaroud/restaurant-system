using Restaurant.API.DTOs;
using Restaurant.API.Enums;

namespace Restaurant.API.Interfaces;

public interface IReservationsService
{
    Task<ReservationResponseDto> CreateAsync(CreateReservationDto dto, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ReservationResponseDto>> GetAllAsync(DateOnly? date, ReservationStatus? status, string? phoneNumber, CancellationToken cancellationToken);
    Task<ReservationResponseDto> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<ReservationResponseDto> UpdateAsync(int id, UpdateReservationDto dto, CancellationToken cancellationToken);
    Task<ReservationResponseDto> UpdateStatusAsync(int id, UpdateReservationStatusDto dto, CancellationToken cancellationToken);
    Task DeleteAsync(int id, CancellationToken cancellationToken);
}
