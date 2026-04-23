using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreateWaiterDto(string FirstName, string LastName, string Email, string PhoneNumber, string Password);
public sealed record CreateAdminDto(string FirstName, string LastName, string Email, string PhoneNumber, string Password);
public sealed record UserResponseDto(int Id, string FirstName, string LastName, string Email, string PhoneNumber, UserRole Role);
