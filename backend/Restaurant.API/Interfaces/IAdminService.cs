using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IAdminService
{
    Task<UserResponseDto> CreateWaiterAsync(CreateWaiterDto dto, CancellationToken cancellationToken);
    Task<UserResponseDto> CreateAdminAsync(CreateAdminDto dto, CancellationToken cancellationToken);
}
