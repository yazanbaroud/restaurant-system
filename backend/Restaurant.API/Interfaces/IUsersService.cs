using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IUsersService
{
    Task<IReadOnlyCollection<UserResponseDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<UserResponseDto> GetByIdAsync(int id, CancellationToken cancellationToken);
}
