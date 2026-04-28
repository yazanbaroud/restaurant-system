using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IBusinessHoursService
{
    Task<IReadOnlyCollection<BusinessHourResponseDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<IReadOnlyCollection<BusinessHourResponseDto>> UpdateAllAsync(UpdateBusinessHoursDto dto, CancellationToken cancellationToken);
    Task EnsureReservationTimeAllowedAsync(DateOnly reservationDate, TimeOnly reservationTime, CancellationToken cancellationToken);
}
