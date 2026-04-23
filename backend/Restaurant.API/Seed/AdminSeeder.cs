using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.API.Data;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Models;

namespace Restaurant.API.Seed;

public sealed class SeedAdminOptions
{
    public string Email { get; set; } = "admin@restaurant.local";
    public string Password { get; set; } = "Admin123!";
    public string FirstName { get; set; } = "System";
    public string LastName { get; set; } = "Admin";
    public string PhoneNumber { get; set; } = "0000000000";
}

public static class AdminSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<SeedAdminOptions>>().Value;
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("AdminSeeder");

        if ((await db.Database.GetPendingMigrationsAsync()).Any())
        {
            await db.Database.MigrateAsync();
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        var email = options.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Role == UserRole.Admin))
        {
            return;
        }

        db.Users.Add(new User
        {
            FirstName = options.FirstName,
            LastName = options.LastName,
            Email = email,
            PhoneNumber = options.PhoneNumber,
            PasswordHash = hasher.HashPassword(options.Password),
            Role = UserRole.Admin
        });

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded initial admin account {Email}", email);
    }
}
