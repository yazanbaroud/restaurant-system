using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record RegisterDto(string FirstName, string LastName, string Email, string PhoneNumber, string Password);
public sealed record LoginDto(string Email, string Password);
public sealed record CurrentUserDto(int Id, string FirstName, string LastName, string Email, string PhoneNumber, UserRole Role);
public sealed record AuthResponseDto(string Token, DateTime ExpiresAtUtc, CurrentUserDto User);
