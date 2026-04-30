using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Tests.Infrastructure;

namespace Restaurant.API.Tests;

public sealed class AuthSecurityTests
{
    private const string Password = "Secure123!";

    [Fact]
    public async Task DisabledUser_CannotLogin()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterCustomerAsync(client, "disabled-login@test.local");

        await DisableUserAsync(factory, auth.User.Id);

        var login = await client.PostAsJsonAsync("/api/Auth/login", new
        {
            email = "disabled-login@test.local",
            password = Password
        });

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task DisabledUser_AccessTokenIsRejected()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterCustomerAsync(client, "disabled-token@test.local");

        await DisableUserAsync(factory, auth.User.Id);

        using var authorized = factory.CreateClient();
        authorized.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        var response = await authorized.GetAsync("/api/Auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PasswordChange_InvalidatesOldAccessAndRefreshTokens()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterCustomerAsync(client, "password-change@test.local");

        using var authorized = factory.CreateClient();
        authorized.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        var changePassword = await authorized.PutAsJsonAsync("/api/Auth/me/password", new
        {
            currentPassword = Password,
            newPassword = "NewSecure123!"
        });

        Assert.Equal(HttpStatusCode.NoContent, changePassword.StatusCode);

        var oldAccess = await authorized.GetAsync("/api/Auth/me");
        var oldRefresh = await client.PostAsJsonAsync("/api/Auth/refresh", new { refreshToken = auth.RefreshToken });

        Assert.Equal(HttpStatusCode.Unauthorized, oldAccess.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, oldRefresh.StatusCode);
    }

    [Fact]
    public async Task RefreshToken_RotatesAndRevokesOriginalToken()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterCustomerAsync(client, "refresh-rotate@test.local");

        var refresh = await client.PostAsJsonAsync("/api/Auth/refresh", new { refreshToken = auth.RefreshToken });
        var rotated = await refresh.Content.ReadFromJsonAsync<AuthResponseDto>();
        var replay = await client.PostAsJsonAsync("/api/Auth/refresh", new { refreshToken = auth.RefreshToken });

        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
        Assert.NotNull(rotated);
        Assert.NotEqual(auth.Token, rotated.Token);
        Assert.NotEqual(auth.RefreshToken, rotated.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        var originalHash = RefreshTokenSecurity.HashToken(auth.RefreshToken);
        var replacementHash = RefreshTokenSecurity.HashToken(rotated.RefreshToken);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var original = await db.RefreshTokens.SingleAsync(x => x.TokenHash == originalHash);
        var replacement = await db.RefreshTokens.SingleAsync(x => x.TokenHash == replacementHash);

        Assert.NotNull(original.RevokedAtUtc);
        Assert.Equal(replacement.TokenHash, original.ReplacedByTokenHash);
        Assert.Null(replacement.RevokedAtUtc);
    }

    [Fact]
    public async Task Logout_RevokesRefreshToken()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterCustomerAsync(client, "logout@test.local");

        using var authorized = factory.CreateClient();
        authorized.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        var logout = await authorized.PostAsJsonAsync("/api/Auth/logout", new { refreshToken = auth.RefreshToken });
        var refreshAfterLogout = await client.PostAsJsonAsync("/api/Auth/refresh", new { refreshToken = auth.RefreshToken });

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshAfterLogout.StatusCode);

        var hash = RefreshTokenSecurity.HashToken(auth.RefreshToken);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var token = await db.RefreshTokens.SingleAsync(x => x.TokenHash == hash);
        Assert.NotNull(token.RevokedAtUtc);
    }

    [Fact]
    public async Task Customer_CannotAccessAdminOrWaiterEndpoints()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        using var customer = factory.CreateAuthenticatedClient(seed.CustomerId);

        var adminEndpoint = await customer.GetAsync("/api/Users");
        var waiterEndpoint = await customer.GetAsync("/api/Orders");

        Assert.Equal(HttpStatusCode.Forbidden, adminEndpoint.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, waiterEndpoint.StatusCode);
    }

    private static async Task<AuthResponseDto> RegisterCustomerAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/Auth/register", new
        {
            firstName = "Security",
            lastName = "Customer",
            email,
            phoneNumber = "0501234567",
            password = Password
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrWhiteSpace(auth.Token));
        Assert.False(string.IsNullOrWhiteSpace(auth.RefreshToken));
        return auth;
    }

    private static async Task DisableUserAsync(TestWebApplicationFactory factory, int userId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(x => x.Id == userId);
        user.IsActive = false;
        user.TokenVersion++;
        await db.SaveChangesAsync();
    }
}
