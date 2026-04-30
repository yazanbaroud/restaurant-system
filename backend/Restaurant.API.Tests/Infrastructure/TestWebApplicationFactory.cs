using System.Net.Http.Headers;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Restaurant.API.Data;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Models;

namespace Restaurant.API.Tests.Infrastructure;

public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private const string JwtIssuer = "Restaurant.Api.Tests";
    private const string JwtAudience = "Restaurant.Api.Tests";
    private const string JwtSecret = "RestaurantApiTestsJwtSecret_AtLeast32Bytes_2026";

    private readonly string connectionString =
        $"Data Source=RestaurantTests-{Guid.NewGuid():N};Mode=Memory;Cache=Shared;Default Timeout=30";
    private SqliteConnection? rootConnection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        rootConnection = new SqliteConnection(connectionString);
        rootConnection.Open();

        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
                ["Jwt:Issuer"] = JwtIssuer,
                ["Jwt:Audience"] = JwtAudience,
                ["Jwt:Secret"] = JwtSecret,
                ["Jwt:ExpirationMinutes"] = "120",
                ["SeedAdmin:Email"] = "seed-admin@test.local",
                ["SeedAdmin:Password"] = "Admin123!",
                ["SeedAdmin:FirstName"] = "Seed",
                ["SeedAdmin:LastName"] = "Admin",
                ["SeedAdmin:PhoneNumber"] = "0500000000"
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
            services.PostConfigure<JwtSettings>(settings =>
            {
                settings.Issuer = JwtIssuer;
                settings.Audience = JwtAudience;
                settings.Secret = JwtSecret;
                settings.ExpirationMinutes = 120;
            });
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.TokenValidationParameters.ValidIssuer = JwtIssuer;
                options.TokenValidationParameters.ValidAudience = JwtAudience;
                options.TokenValidationParameters.IssuerSigningKey =
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
            });
        });
    }

    public async Task<TestSeed> ResetDatabaseAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();

        var admin = new User
        {
            FirstName = "Ada",
            LastName = "Admin",
            Email = "admin@test.local",
            PhoneNumber = "0500000001",
            PasswordHash = "not-used",
            Role = UserRole.Admin
        };
        var waiter = new User
        {
            FirstName = "Wendy",
            LastName = "Waiter",
            Email = "waiter@test.local",
            PhoneNumber = "0500000002",
            PasswordHash = "not-used",
            Role = UserRole.Waiter
        };
        var customer = new User
        {
            FirstName = "Chris",
            LastName = "Customer",
            Email = "customer@test.local",
            PhoneNumber = "0500000003",
            PasswordHash = "not-used",
            Role = UserRole.Customer
        };
        var otherCustomer = new User
        {
            FirstName = "Olive",
            LastName = "Other",
            Email = "other@test.local",
            PhoneNumber = "0500000004",
            PasswordHash = "not-used",
            Role = UserRole.Customer
        };

        var category = new MenuCategoryRecord
        {
            Id = 1,
            Name = "Tests",
            IsActive = true,
            SortOrder = 10
        };
        var mainItem = new MenuItem
        {
            Id = 1,
            Name = "Test Main",
            Description = "Main dish",
            Category = category.Id,
            Price = 100m,
            IsAvailable = true
        };
        var sideItem = new MenuItem
        {
            Id = 2,
            Name = "Test Side",
            Description = "Side dish",
            Category = category.Id,
            Price = 25m,
            IsAvailable = true
        };
        var tableOne = new Table
        {
            Id = 1,
            Name = "T1",
            Capacity = 4,
            Status = TableStatus.Available
        };
        var tableTwo = new Table
        {
            Id = 2,
            Name = "T2",
            Capacity = 4,
            Status = TableStatus.Available
        };

        db.Users.AddRange(admin, waiter, customer, otherCustomer);
        db.MenuCategories.Add(category);
        db.MenuItems.AddRange(mainItem, sideItem);
        db.Tables.AddRange(tableOne, tableTwo);
        await db.SaveChangesAsync();

        return new TestSeed(
            admin.Id,
            waiter.Id,
            customer.Id,
            otherCustomer.Id,
            mainItem.Id,
            sideItem.Id,
            tableOne.Id,
            tableTwo.Id);
    }

    public HttpClient CreateAuthenticatedClient(int userId)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(userId));
        return client;
    }

    public async Task<int> CreateOrderAsync(
        TestSeed seed,
        OrderStatus status = OrderStatus.Open,
        KitchenStatus kitchenStatus = KitchenStatus.New,
        PaymentStatus paymentStatus = PaymentStatus.Unpaid,
        bool assignTable = false,
        decimal totalAmount = 100m,
        decimal paidAmount = 0m)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var order = new Order
        {
            UserId = seed.WaiterId,
            CustomerFirstName = "Test",
            CustomerLastName = "Order",
            CreatedAt = DateTime.UtcNow,
            OrderNumber = $"T-{Guid.NewGuid():N}",
            Status = status,
            KitchenStatus = kitchenStatus,
            PaymentStatus = paymentStatus,
            OrderType = assignTable ? OrderType.DineIn : OrderType.TakeAway,
            TotalAmount = totalAmount
        };
        order.Items.Add(new OrderItem
        {
            MenuItemId = seed.MainItemId,
            Quantity = 1,
            UnitPrice = totalAmount
        });

        if (assignTable)
        {
            order.OrderTables.Add(new OrderTable { TableId = seed.TableOneId });
            var table = await db.Tables.SingleAsync(x => x.Id == seed.TableOneId);
            table.Status = TableStatus.Occupied;
        }

        if (paidAmount > 0)
        {
            order.Payments.Add(new Payment
            {
                Amount = paidAmount,
                Method = PaymentMethod.Cash,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = seed.WaiterId,
                IdempotencyKey = Guid.NewGuid()
            });
        }

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return order.Id;
    }

    public async Task<T?> FindAsync<T>(params object[] keyValues)
        where T : class
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Set<T>().FindAsync(keyValues);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        rootConnection?.Dispose();
    }

    private string CreateToken(int userId)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var generator = scope.ServiceProvider.GetRequiredService<IJwtTokenGenerator>();
        var user = db.Users.AsNoTracking().Single(x => x.Id == userId);
        return generator.Generate(user).Token;
    }
}

public sealed record TestSeed(
    int AdminId,
    int WaiterId,
    int CustomerId,
    int OtherCustomerId,
    int MainItemId,
    int SideItemId,
    int TableOneId,
    int TableTwoId);
