using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IUsersService
{
    Task<IReadOnlyCollection<UserResponseDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<UserResponseDto> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<UserResponseDto> CreateAsync(CreateUserDto dto, CancellationToken cancellationToken);
    Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto, CancellationToken cancellationToken);
    Task<UserResponseDto> UpdateRoleAsync(int currentUserId, int id, UpdateUserRoleDto dto, CancellationToken cancellationToken);
}
