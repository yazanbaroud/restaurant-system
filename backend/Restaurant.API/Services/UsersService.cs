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
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);
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
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);
        await EnsureEmailAvailableAsync(dto.Email, id, cancellationToken);

        user.FirstName = dto.FirstName.Trim();
        user.LastName = dto.LastName.Trim();
        user.Email = dto.Email.Trim().ToLowerInvariant();
        user.PhoneNumber = dto.PhoneNumber.Trim();

        await db.SaveChangesAsync(cancellationToken);
        return user.ToUserResponse();
    }

    public async Task<UserResponseDto> UpdateRoleAsync(int currentUserId, int id, UpdateUserRoleDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);

        if (currentUserId == id)
        {
            throw new ApiException("You cannot change your own role while signed in.", StatusCodes.Status409Conflict);
        }

        if (user.Role == UserRole.Admin && dto.Role != UserRole.Admin)
        {
            var adminCount = await db.Users.CountAsync(x => x.Role == UserRole.Admin, cancellationToken);
            if (adminCount <= 1)
            {
                throw new ApiException("At least one admin user must remain.", StatusCodes.Status409Conflict);
            }
        }

        user.Role = dto.Role;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("User {UserId} role updated to {Role}", user.Id, user.Role);
        return user.ToUserResponse();
    }

    private async Task EnsureEmailAvailableAsync(string email, int? currentUserId, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var exists = await db.Users.AnyAsync(
            x => x.Email == normalizedEmail && (!currentUserId.HasValue || x.Id != currentUserId.Value),
            cancellationToken);

        if (exists)
        {
            throw new ApiException("Email is already in use.", StatusCodes.Status409Conflict);
        }
    }
}
