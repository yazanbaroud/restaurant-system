using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class UsersService(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    ILogger<UsersService> logger) : IUsersService
{
    public async Task<IReadOnlyCollection<UserResponseDto>> GetAllAsync(CancellationToken cancellationToken) =>
        await db.Users.AsNoTracking()
            .OrderBy(x => x.Role)
            .ThenBy(x => x.LastName)
            .Select(x => x.ToUserResponse())
            .ToArrayAsync(cancellationToken);

    public async Task<UserResponseDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("המשתמש לא נמצא.", StatusCodes.Status404NotFound);
        return user.ToUserResponse();
    }

    public async Task<UserResponseDto> CreateAsync(CreateUserDto dto, CancellationToken cancellationToken)
    {
        await EnsureEmailAvailableAsync(dto.Email, null, cancellationToken);

        var user = new User
        {
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            Email = dto.Email.Trim().ToLowerInvariant(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            PasswordHash = passwordHasher.HashPassword(dto.Password),
            Role = dto.Role
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Admin created user {UserId} with role {Role}", user.Id, user.Role);
        return user.ToUserResponse();
    }

    public async Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("המשתמש לא נמצא.", StatusCodes.Status404NotFound);
        await EnsureEmailAvailableAsync(dto.Email, id, cancellationToken);

        user.FirstName = dto.FirstName.Trim();
        user.LastName = dto.LastName.Trim();
        user.Email = dto.Email.Trim().ToLowerInvariant();
        user.PhoneNumber = dto.PhoneNumber.Trim();
        user.TokenVersion++;

        await db.SaveChangesAsync(cancellationToken);
        return user.ToUserResponse();
    }

    public async Task<UserResponseDto> UpdateRoleAsync(int currentUserId, int id, UpdateUserRoleDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("המשתמש לא נמצא.", StatusCodes.Status404NotFound);

        if (currentUserId == id)
        {
            throw new ApiException("לא ניתן לשנות את התפקיד של החשבון הפעיל.", StatusCodes.Status409Conflict);
        }

        if (user.IsActive && user.Role == UserRole.Admin && dto.Role != UserRole.Admin)
        {
            var adminCount = await db.Users.CountAsync(x => x.Role == UserRole.Admin && x.IsActive, cancellationToken);
            if (adminCount <= 1)
            {
                throw new ApiException("חייב להישאר לפחות מנהל אחד.", StatusCodes.Status409Conflict);
            }
        }

        user.Role = dto.Role;
        user.TokenVersion++;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("User {UserId} role updated to {Role}", user.Id, user.Role);
        return user.ToUserResponse();
    }

    public async Task ResetPasswordAsync(int id, ResetUserPasswordDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("המשתמש לא נמצא.", StatusCodes.Status404NotFound);

        user.PasswordHash = passwordHasher.HashPassword(dto.NewPassword);
        user.TokenVersion++;
        await RevokeActiveRefreshTokensAsync(user.Id, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Admin reset password and invalidated tokens for user {UserId}", user.Id);
    }

    public async Task DeleteAsync(int id, int currentUserId, CancellationToken cancellationToken)
    {
        if (id == currentUserId)
        {
            throw new ApiException("לא ניתן למחוק את החשבון הפעיל.", StatusCodes.Status409Conflict);
        }

        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("המשתמש לא נמצא.", StatusCodes.Status404NotFound);

        if (user.Role == UserRole.Admin && user.IsActive)
        {
            var adminCount = await db.Users.CountAsync(x => x.Role == UserRole.Admin && x.IsActive, cancellationToken);
            if (adminCount <= 1)
            {
                throw new ApiException("חייב להישאר לפחות מנהל אחד.", StatusCodes.Status409Conflict);
            }
        }

        user.IsActive = false;
        user.TokenVersion++;
        await RevokeActiveRefreshTokensAsync(user.Id, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Admin disabled user {UserId} with role {Role}", user.Id, user.Role);
    }

    private async Task EnsureEmailAvailableAsync(string email, int? currentUserId, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var exists = await db.Users.AnyAsync(
            x => x.Email == normalizedEmail && (!currentUserId.HasValue || x.Id != currentUserId.Value),
            cancellationToken);

        if (exists)
        {
            throw new ApiException("האימייל כבר נמצא בשימוש.", StatusCodes.Status409Conflict);
        }
    }

    private async Task RevokeActiveRefreshTokensAsync(int userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var activeTokens = await db.RefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
            .ToArrayAsync(cancellationToken);

        foreach (var token in activeTokens)
        {
            token.RevokedAtUtc = now;
        }
    }
}
