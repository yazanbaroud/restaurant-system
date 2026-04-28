using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.API.Data;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Models;

namespace Restaurant.API.Seed;

public sealed class SeedAdminOptions
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
}

public static class AdminSeeder
{
    private static readonly TimeOnly DefaultBusinessOpenTime = new(10, 0);
    private static readonly TimeOnly DefaultBusinessCloseTime = new(23, 0);

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<SeedAdminOptions>>().Value;
        var environment = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("AdminSeeder");

        var migrations = db.Database.GetMigrations();
        if (migrations.Any())
        {
            await db.Database.MigrateAsync();
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        await SeedBusinessHoursAsync(db, logger);

        if (await db.Users.AnyAsync(x => x.Role == UserRole.Admin))
        {
            return;
        }

        ValidateSeedAdminOptions(options, environment);
        var email = options.Email.Trim().ToLowerInvariant();

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

    private static void ValidateSeedAdminOptions(SeedAdminOptions options, IHostEnvironment environment)
    {
        if (string.IsNullOrWhiteSpace(options.Email)
            || string.IsNullOrWhiteSpace(options.Password)
            || string.IsNullOrWhiteSpace(options.FirstName)
            || string.IsNullOrWhiteSpace(options.LastName)
            || string.IsNullOrWhiteSpace(options.PhoneNumber))
        {
            throw new InvalidOperationException("Seed admin configuration is invalid: configure SeedAdmin email, password, name, and phone before creating the first admin.");
        }

        if (!environment.IsDevelopment()
            && string.Equals(options.Password, "Admin123!", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Seed admin configuration is invalid: production must not use the local development admin password.");
        }
    }

    private static async Task SeedBusinessHoursAsync(AppDbContext db, ILogger logger)
    {
        if (await db.BusinessHours.AnyAsync())
        {
            return;
        }

        var now = DateTime.UtcNow;
        for (var day = 0; day < 7; day++)
        {
            db.BusinessHours.Add(new RestaurantBusinessHour
            {
                DayOfWeek = day,
                IsOpen = true,
                OpenTime = DefaultBusinessOpenTime,
                CloseTime = DefaultBusinessCloseTime,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded default restaurant business hours.");
    }
}
