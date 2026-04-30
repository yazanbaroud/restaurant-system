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
    IAuditService audit,
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
            throw new ApiException("כבר קיים משתמש עם האימייל הזה.", StatusCodes.Status409Conflict);
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
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.User, user.Id, AuditActions.Create, NewValues: UserAuditSnapshot(user)),
            cancellationToken);
        logger.LogInformation("{Role} account created with user id {UserId}", role, user.Id);
        return user.ToUserResponse();
    }

    private static UserAuditValues UserAuditSnapshot(User user) =>
        new(user.Role.ToString(), user.IsActive, user.TokenVersion);

    private sealed record UserAuditValues(string Role, bool IsActive, int TokenVersion);
}
