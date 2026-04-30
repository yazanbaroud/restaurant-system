using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
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
    IHttpContextAccessor httpContextAccessor,
    IAuditService audit,
    IOptions<JwtSettings> jwtOptions,
    ILogger<AuthService> logger) : IAuthService
{
    private readonly JwtSettings jwtSettings = jwtOptions.Value;

    public async Task<AuthResponseDto> RegisterCustomerAsync(RegisterDto dto, CancellationToken cancellationToken)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == normalizedEmail, cancellationToken))
        {
            throw new ApiException("An account with this email already exists.", StatusCodes.Status409Conflict);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var user = new User
        {
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            Email = normalizedEmail,
            PhoneNumber = dto.PhoneNumber.Trim(),
            PasswordHash = passwordHasher.HashPassword(dto.Password),
            Role = UserRole.Customer,
            IsActive = true
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        var response = await IssueTokenPairAsync(user, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.User, user.Id, AuditActions.Create, user.Id, NewValues: UserAuditSnapshot(user)),
            cancellationToken);
        logger.LogInformation("Customer registered with user id {UserId}", user.Id);
        return response;
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto, CancellationToken cancellationToken)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email, cancellationToken);
        logger.LogInformation("Login attempt for {Email}", email);

        if (user is null || !user.IsActive || !passwordHasher.VerifyPassword(dto.Password, user.PasswordHash))
        {
            throw new ApiException("Invalid email or password.", StatusCodes.Status401Unauthorized);
        }

        return await IssueTokenPairAsync(user, cancellationToken);
    }

    public async Task<AuthResponseDto> RefreshAsync(RefreshTokenDto dto, CancellationToken cancellationToken)
    {
        var tokenHash = RefreshTokenSecurity.HashToken(dto.RefreshToken);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var refreshToken = await LoadRefreshTokenForUpdateAsync(tokenHash, cancellationToken);
        var now = DateTime.UtcNow;
        if (refreshToken is null || refreshToken.RevokedAtUtc is not null || refreshToken.ExpiresAtUtc <= now)
        {
            logger.LogWarning("Rejected refresh token rotation because token was missing, revoked, or expired");
            throw new ApiException("Refresh token is invalid or expired.", StatusCodes.Status401Unauthorized);
        }

        if (!refreshToken.User.IsActive)
        {
            logger.LogWarning("Rejected refresh token rotation for disabled user {UserId}", refreshToken.UserId);
            throw new ApiException("User account is disabled.", StatusCodes.Status401Unauthorized);
        }

        var replacement = CreateRefreshToken(refreshToken.UserId, now);
        refreshToken.RevokedAtUtc = now;
        refreshToken.RevokedByIp = CurrentIpAddress();
        refreshToken.ReplacedByTokenHash = replacement.Entity.TokenHash;

        db.RefreshTokens.Add(replacement.Entity);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation("Rotated refresh token {RefreshTokenId} for user {UserId}", refreshToken.Id, refreshToken.UserId);
        return CreateAuthResponse(refreshToken.User, replacement.PlainTextToken, replacement.Entity.ExpiresAtUtc);
    }

    public async Task LogoutAsync(int? userId, LogoutDto dto, CancellationToken cancellationToken)
    {
        var tokenHash = RefreshTokenSecurity.HashToken(dto.RefreshToken);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var refreshToken = await LoadRefreshTokenForUpdateAsync(tokenHash, cancellationToken);
        if (refreshToken is null)
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        if (userId is > 0 && refreshToken.UserId != userId.Value)
        {
            throw new ApiException("Refresh token does not belong to the authenticated user.", StatusCodes.Status403Forbidden);
        }

        if (refreshToken.RevokedAtUtc is null)
        {
            refreshToken.RevokedAtUtc = DateTime.UtcNow;
            refreshToken.RevokedByIp = CurrentIpAddress();
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        logger.LogInformation("Refresh token {RefreshTokenId} was revoked during logout for user {UserId}", refreshToken.Id, refreshToken.UserId);
    }

    public async Task<CurrentUserDto> GetCurrentUserAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("User was not found.", StatusCodes.Status404NotFound);
        EnsureActive(user);
        return user.ToCurrentUser();
    }

    public async Task<CurrentUserDto> UpdateCurrentUserAsync(int userId, UpdateCurrentUserDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("User was not found.", StatusCodes.Status404NotFound);
        EnsureActive(user);

        user.FirstName = dto.FirstName.Trim();
        user.LastName = dto.LastName.Trim();
        user.PhoneNumber = dto.PhoneNumber.Trim();

        await db.SaveChangesAsync(cancellationToken);
        return user.ToCurrentUser();
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordDto dto, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("User was not found.", StatusCodes.Status404NotFound);
        EnsureActive(user);

        if (!passwordHasher.VerifyPassword(dto.CurrentPassword, user.PasswordHash))
        {
            throw new ApiException("Current password is incorrect.", StatusCodes.Status400BadRequest);
        }

        user.PasswordHash = passwordHasher.HashPassword(dto.NewPassword);
        user.TokenVersion++;
        await RevokeActiveRefreshTokensAsync(user.Id, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.User, user.Id, AuditActions.PasswordChanged, user.Id, NewValues: new { user.TokenVersion }),
            cancellationToken);
        logger.LogInformation("User {UserId} changed their password and invalidated existing tokens", user.Id);
    }

    private async Task<AuthResponseDto> IssueTokenPairAsync(User user, CancellationToken cancellationToken)
    {
        var refreshToken = CreateRefreshToken(user.Id, DateTime.UtcNow);
        db.RefreshTokens.Add(refreshToken.Entity);
        await db.SaveChangesAsync(cancellationToken);
        return CreateAuthResponse(user, refreshToken.PlainTextToken, refreshToken.Entity.ExpiresAtUtc);
    }

    private AuthResponseDto CreateAuthResponse(User user, string refreshToken, DateTime refreshTokenExpiresAtUtc)
    {
        var (token, expiresAtUtc) = jwtTokenGenerator.Generate(user);
        return new AuthResponseDto(token, expiresAtUtc, refreshToken, refreshTokenExpiresAtUtc, user.ToCurrentUser());
    }

    private (string PlainTextToken, RefreshToken Entity) CreateRefreshToken(int userId, DateTime utcNow)
    {
        var plainTextToken = RefreshTokenSecurity.CreateToken();
        var entity = new RefreshToken
        {
            UserId = userId,
            TokenHash = RefreshTokenSecurity.HashToken(plainTextToken),
            CreatedAtUtc = utcNow,
            ExpiresAtUtc = utcNow.AddDays(jwtSettings.RefreshTokenExpirationDays),
            CreatedByIp = CurrentIpAddress()
        };

        return (plainTextToken, entity);
    }

    private async Task<RefreshToken?> LoadRefreshTokenForUpdateAsync(string tokenHash, CancellationToken cancellationToken) =>
        await RefreshTokensForUpdate(tokenHash)
            .Include(x => x.User)
            .SingleOrDefaultAsync(cancellationToken);

    private IQueryable<RefreshToken> RefreshTokensForUpdate(string tokenHash) =>
        IsSqlServer()
            ? db.RefreshTokens.FromSqlInterpolated($"SELECT * FROM [RefreshTokens] WITH (UPDLOCK, HOLDLOCK) WHERE [TokenHash] = {tokenHash}")
            : db.RefreshTokens.Where(x => x.TokenHash == tokenHash);

    private async Task RevokeActiveRefreshTokensAsync(int userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var ipAddress = CurrentIpAddress();
        var activeTokens = await db.RefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
            .ToArrayAsync(cancellationToken);

        foreach (var token in activeTokens)
        {
            token.RevokedAtUtc = now;
            token.RevokedByIp = ipAddress;
        }
    }

    private static void EnsureActive(User user)
    {
        if (!user.IsActive)
        {
            throw new ApiException("User account is disabled.", StatusCodes.Status401Unauthorized);
        }
    }

    private string? CurrentIpAddress() =>
        httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString();

    private bool IsSqlServer() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.SqlServer", StringComparison.Ordinal);

    private static UserAuditValues UserAuditSnapshot(User user) =>
        new(user.Role.ToString(), user.IsActive, user.TokenVersion);

    private sealed record UserAuditValues(string Role, bool IsActive, int TokenVersion);
}
