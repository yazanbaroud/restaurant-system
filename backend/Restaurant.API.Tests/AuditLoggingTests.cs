using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Models;
using Restaurant.API.Tests.Infrastructure;

namespace Restaurant.API.Tests;

public sealed class AuditLoggingTests
{
    [Fact]
    public async Task AuditLogs_KitchenAndWaiterCannotAccess()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();

        using var kitchen = factory.CreateAuthenticatedClient(seed.KitchenId);
        using var waiter = factory.CreateAuthenticatedClient(seed.WaiterId);

        var kitchenResponse = await kitchen.GetAsync("/api/audit-logs");
        var waiterResponse = await waiter.GetAsync("/api/audit-logs");

        Assert.Equal(HttpStatusCode.Forbidden, kitchenResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, waiterResponse.StatusCode);
    }

    [Fact]
    public async Task AuditLogs_AdminCanAccessWithPagination()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();

        using var admin = factory.CreateAuthenticatedClient(seed.AdminId);
        var response = await admin.GetAsync("/api/audit-logs?page=1&pageSize=10");
        var body = await response.Content.ReadFromJsonAsync<PagedAuditLogsResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.Equal(1, body.Page);
        Assert.Equal(10, body.PageSize);
        Assert.Empty(body.Items);
    }

    [Fact]
    public async Task CreatingOrderAndPaymentCreatesAuditLogs()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        using var admin = factory.CreateAuthenticatedClient(seed.AdminId);
        using var waiter = factory.CreateAuthenticatedClient(seed.WaiterId);

        var orderResponse = await waiter.PostAsJsonAsync("/api/Orders", CreateOrderRequest(seed));
        var order = await orderResponse.Content.ReadFromJsonAsync<OrderResponseDto>();

        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        Assert.NotNull(order);

        var paymentResponse = await admin.PostAsJsonAsync("/api/Payments", PaymentRequest(order.Id, 40m, Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Created, paymentResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var auditLogs = await db.AuditLogs.AsNoTracking().ToArrayAsync();

        Assert.Contains(auditLogs, x =>
            x.EntityType == AuditEntityTypes.Order &&
            x.EntityId == order.Id &&
            x.Action == AuditActions.Create &&
            x.PerformedByUserId == seed.WaiterId);
        Assert.Contains(auditLogs, x =>
            x.EntityType == AuditEntityTypes.Payment &&
            x.Action == AuditActions.PaymentCreated &&
            x.PerformedByUserId == seed.AdminId);
    }

    [Fact]
    public async Task AuditLogs_DoNotStoreSensitiveFields()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        using var admin = factory.CreateAuthenticatedClient(seed.AdminId);
        using var waiter = factory.CreateAuthenticatedClient(seed.WaiterId);

        const string createPassword = "UltraSecret123!";
        const string resetPassword = "RotatedSecret123!";
        var createUserResponse = await admin.PostAsJsonAsync("/api/Users", new
        {
            firstName = "Sensitive",
            lastName = "Staff",
            email = "sensitive-audit@test.local",
            phoneNumber = "0501234567",
            role = UserRole.Waiter,
            password = createPassword
        });
        var createdUser = await createUserResponse.Content.ReadFromJsonAsync<UserResponseDto>();
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);
        Assert.NotNull(createdUser);

        var resetResponse = await admin.PutAsJsonAsync($"/api/Users/{createdUser.Id}/password-reset", new
        {
            newPassword = resetPassword
        });
        Assert.Equal(HttpStatusCode.NoContent, resetResponse.StatusCode);

        var orderResponse = await waiter.PostAsJsonAsync("/api/Orders", CreateOrderRequest(seed));
        var order = await orderResponse.Content.ReadFromJsonAsync<OrderResponseDto>();
        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        Assert.NotNull(order);

        var idempotencyKey = Guid.NewGuid();
        var paymentResponse = await admin.PostAsJsonAsync("/api/Payments", PaymentRequest(order.Id, 25m, idempotencyKey));
        Assert.Equal(HttpStatusCode.Created, paymentResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var payload = await db.AuditLogs.AsNoTracking()
            .Select(x => (x.OldValues ?? string.Empty) + "\n" + (x.NewValues ?? string.Empty))
            .ToArrayAsync();
        var combined = string.Join("\n", payload);

        Assert.DoesNotContain(createPassword, combined, StringComparison.Ordinal);
        Assert.DoesNotContain(resetPassword, combined, StringComparison.Ordinal);
        Assert.DoesNotContain(idempotencyKey.ToString(), combined, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("passwordHash", combined, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("refreshToken", combined, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("tokenHash", combined, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("idempotencyKey", combined, StringComparison.OrdinalIgnoreCase);
    }

    private static object CreateOrderRequest(TestSeed seed) =>
        new
        {
            customerFirstName = "Audit",
            customerLastName = "Guest",
            notes = "regular order",
            orderType = OrderType.TakeAway,
            tableIds = Array.Empty<int>(),
            items = new[] { new { menuItemId = seed.MainItemId, quantity = 1, notes = "" } }
        };

    private static object PaymentRequest(int orderId, decimal amount, Guid idempotencyKey) =>
        new
        {
            orderId,
            idempotencyKey,
            amount,
            method = "Cash"
        };
}
