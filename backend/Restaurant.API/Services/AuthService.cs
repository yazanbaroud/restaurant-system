using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class AuthService(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    IJwtTokenGenerator jwtTokenGenerator,
    ILogger<AuthService> logger) : IAuthService
{
    public async Task<AuthResponseDto> RegisterCustomerAsync(RegisterDto dto, CancellationToken cancellationToken)
    {
        if (await db.Users.AnyAsync(x => x.Email == dto.Email, cancellationToken))
        {
            throw new ApiException("A user with this email already exists.", StatusCodes.Status409Conflict);
        }

        var user = new User
        {
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            Email = dto.Email.Trim().ToLowerInvariant(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            PasswordHash = passwordHasher.HashPassword(dto.Password),
            Role = UserRole.Customer
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Customer registered with user id {UserId}", user.Id);
        return CreateAuthResponse(user);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto, CancellationToken cancellationToken)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email, cancellationToken);
        logger.LogInformation("Login attempt for {Email}", email);

        if (user is null || !passwordHasher.VerifyPassword(dto.Password, user.PasswordHash))
        {
            throw new ApiException("Invalid email or password.", StatusCodes.Status401Unauthorized);
        }

        return CreateAuthResponse(user);
    }

    public async Task<CurrentUserDto> GetCurrentUserAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);
        return user.ToCurrentUser();
    }

    public async Task<CurrentUserDto> UpdateCurrentUserAsync(int userId, UpdateCurrentUserDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);

        user.FirstName = dto.FirstName.Trim();
        user.LastName = dto.LastName.Trim();
        user.PhoneNumber = dto.PhoneNumber.Trim();

        await db.SaveChangesAsync(cancellationToken);
        return user.ToCurrentUser();
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);

        if (!passwordHasher.VerifyPassword(dto.CurrentPassword, user.PasswordHash))
        {
            throw new ApiException("Current password is incorrect.", StatusCodes.Status400BadRequest);
        }

        user.PasswordHash = passwordHasher.HashPassword(dto.NewPassword);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("User {UserId} changed their password", user.Id);
    }

    private AuthResponseDto CreateAuthResponse(User user)
    {
        var (token, expiresAtUtc) = jwtTokenGenerator.Generate(user);
        return new AuthResponseDto(token, expiresAtUtc, user.ToCurrentUser());
    }
}
