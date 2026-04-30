using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record RegisterDto(string FirstName, string LastName, string Email, string PhoneNumber, string Password);
public sealed record LoginDto(string Email, string Password);
public sealed record RefreshTokenDto(string RefreshToken);
public sealed record LogoutDto(string RefreshToken);
public sealed record UpdateCurrentUserDto(string FirstName, string LastName, string PhoneNumber);
public sealed record ChangePasswordDto(string CurrentPassword, string NewPassword);
public sealed record CurrentUserDto(int Id, string FirstName, string LastName, string Email, string PhoneNumber, UserRole Role, bool IsActive);
public sealed record AuthResponseDto(string Token, DateTime ExpiresAtUtc, string RefreshToken, DateTime RefreshTokenExpiresAtUtc, CurrentUserDto User);
