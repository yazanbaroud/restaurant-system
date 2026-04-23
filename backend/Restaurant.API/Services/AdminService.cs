using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class AdminService(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    ILogger<AdminService> logger) : IAdminService
{
    public Task<UserResponseDto> CreateWaiterAsync(CreateWaiterDto dto, CancellationToken cancellationToken) =>
        CreateUserAsync(dto.FirstName, dto.LastName, dto.Email, dto.PhoneNumber, dto.Password, UserRole.Waiter, cancellationToken);

    public Task<UserResponseDto> CreateAdminAsync(CreateAdminDto dto, CancellationToken cancellationToken) =>
        CreateUserAsync(dto.FirstName, dto.LastName, dto.Email, dto.PhoneNumber, dto.Password, UserRole.Admin, cancellationToken);

    private async Task<UserResponseDto> CreateUserAsync(string firstName, string lastName, string email, string phoneNumber, string password, UserRole role, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == normalizedEmail, cancellationToken))
        {
            throw new ApiException("A user with this email already exists.", StatusCodes.Status409Conflict);
        }

        var user = new User
        {
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = normalizedEmail,
            PhoneNumber = phoneNumber.Trim(),
            PasswordHash = passwordHasher.HashPassword(password),
            Role = role
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("{Role} account created with user id {UserId}", role, user.Id);
        return user.ToUserResponse();
    }
}
