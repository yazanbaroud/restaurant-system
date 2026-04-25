using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> RegisterCustomerAsync(RegisterDto dto, CancellationToken cancellationToken);
    Task<AuthResponseDto> LoginAsync(LoginDto dto, CancellationToken cancellationToken);
    Task<CurrentUserDto> GetCurrentUserAsync(int userId, CancellationToken cancellationToken);
    Task<CurrentUserDto> UpdateCurrentUserAsync(int userId, UpdateCurrentUserDto dto, CancellationToken cancellationToken);
    Task ChangePasswordAsync(int userId, ChangePasswordDto dto, CancellationToken cancellationToken);
}
