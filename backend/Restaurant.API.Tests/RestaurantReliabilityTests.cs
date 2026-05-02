using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Models;
using Restaurant.API.Tests.Infrastructure;

namespace Restaurant.API.Tests;

public sealed class RestaurantReliabilityTests
{
    [Fact]
    public async Task Payment_PreventsOverpayment()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed);
        var client = factory.CreateAuthenticatedClient(seed.AdminId);

        var response = await client.PostAsJsonAsync("/api/Payments", PaymentRequest(orderId, 101m, Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertPaymentTotalsAsync(factory, orderId, expectedCount: 0, expectedPaid: 0m);
    }

    [Fact]
    public async Task Payment_WaiterCannotAccessPaymentApis()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed);
        var waiter = factory.CreateAuthenticatedClient(seed.WaiterId);

        var create = await waiter.PostAsJsonAsync("/api/Payments", PaymentRequest(orderId, 10m, Guid.NewGuid()));
        var refund = await waiter.PostAsJsonAsync("/api/Payments/refunds", new
        {
            orderId,
            idempotencyKey = Guid.NewGuid(),
            amount = 1m,
            reason = "not allowed",
            method = "Cash"
        });
        var byOrder = await waiter.GetAsync($"/api/Payments/order/{orderId}");
        var refundsByOrder = await waiter.GetAsync($"/api/Payments/order/{orderId}/refunds");

        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, refund.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, byOrder.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, refundsByOrder.StatusCode);
    }

    [Fact]
    public async Task Payment_IdempotencyReplayReturnsExistingPayment()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed);
        var client = factory.CreateAuthenticatedClient(seed.AdminId);
        var key = Guid.NewGuid();

        var first = await PostPaymentAsync(client, orderId, 40m, key);
        var second = await PostPaymentAsync(client, orderId, 40m, key);

        Assert.Equal(HttpStatusCode.Created, first.Response.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.Response.StatusCode);
        Assert.NotNull(first.Body);
        Assert.NotNull(second.Body);
        Assert.Equal(first.Body.Payment.Id, second.Body.Payment.Id);
        Assert.Equal(40m, second.Body.PaidAmount);
        await AssertPaymentTotalsAsync(factory, orderId, expectedCount: 1, expectedPaid: 40m);
    }

    [Fact]
    public async Task Payment_IdempotencyMismatchReturnsConflict()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed);
        var client = factory.CreateAuthenticatedClient(seed.AdminId);
        var key = Guid.NewGuid();

        var first = await PostPaymentAsync(client, orderId, 40m, key);
        var mismatch = await client.PostAsJsonAsync("/api/Payments", PaymentRequest(orderId, 30m, key));

        Assert.Equal(HttpStatusCode.Created, first.Response.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, mismatch.StatusCode);
        await AssertPaymentTotalsAsync(factory, orderId, expectedCount: 1, expectedPaid: 40m);
    }

    [Fact]
    public async Task Payment_PaidOrderRejectsNewPayments()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed);
        var client = factory.CreateAuthenticatedClient(seed.AdminId);

        var first = await PostPaymentAsync(client, orderId, 100m, Guid.NewGuid());
        var second = await client.PostAsJsonAsync("/api/Payments", PaymentRequest(orderId, 1m, Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.Created, first.Response.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        await AssertPaymentTotalsAsync(factory, orderId, expectedCount: 1, expectedPaid: 100m);
    }

    [Fact]
    public async Task Payment_FullPaymentDoesNotCompleteOrderBeforeServed()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed, kitchenStatus: KitchenStatus.New);
        var client = factory.CreateAuthenticatedClient(seed.AdminId);

        var payment = await PostPaymentAsync(client, orderId, 100m, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Created, payment.Response.StatusCode);
        Assert.NotNull(payment.Body);
        Assert.Equal(PaymentStatus.Paid, payment.Body.PaymentStatus);
        Assert.Equal(KitchenStatus.New, payment.Body.KitchenStatus);
        Assert.Equal(OrderStatus.Open, payment.Body.OrderStatus);
    }

    [Fact]
    public async Task Payment_CompletingServedOrderReleasesTable()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed, kitchenStatus: KitchenStatus.Served, assignTable: true);
        var client = factory.CreateAuthenticatedClient(seed.AdminId);

        var payment = await PostPaymentAsync(client, orderId, 100m, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Created, payment.Response.StatusCode);
        Assert.NotNull(payment.Body);
        Assert.Equal(OrderStatus.Completed, payment.Body.OrderStatus);
        Assert.Equal(PaymentStatus.Paid, payment.Body.PaymentStatus);
        Assert.Equal(0m, payment.Body.RemainingAmount);

        var table = await factory.FindAsync<Table>(seed.TableOneId);
        Assert.NotNull(table);
        Assert.Equal(TableStatus.Available, table.Status);
    }

    [Fact]
    public async Task MarkPaid_WithoutStoredPaymentsReturnsConflict()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        var response = await admin.PostAsJsonAsync($"/api/Orders/{orderId}/mark-paid", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertPaymentTotalsAsync(factory, orderId, expectedCount: 0, expectedPaid: 0m);
    }

    [Fact]
    public async Task Cancel_OrderWithPaymentsReturnsConflict()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(
            seed,
            paymentStatus: PaymentStatus.Partial,
            totalAmount: 100m,
            paidAmount: 50m);
        var client = factory.CreateAuthenticatedClient(seed.WaiterId);

        var response = await client.PostAsJsonAsync($"/api/Orders/{orderId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_ServedOrderReturnsConflict()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed, kitchenStatus: KitchenStatus.Served);
        var client = factory.CreateAuthenticatedClient(seed.WaiterId);

        var response = await client.PostAsJsonAsync($"/api/Orders/{orderId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData((int)OrderStatus.Open, (int)KitchenStatus.Served, (int)PaymentStatus.Unpaid, 0)]
    [InlineData((int)OrderStatus.Completed, (int)KitchenStatus.Served, (int)PaymentStatus.Paid, 100)]
    [InlineData((int)OrderStatus.Cancelled, (int)KitchenStatus.New, (int)PaymentStatus.Unpaid, 0)]
    [InlineData((int)OrderStatus.Open, (int)KitchenStatus.New, (int)PaymentStatus.Paid, 100)]
    public async Task Items_CannotBeAddedUpdatedOrDeletedAfterTerminalOrPaidStates(
        int orderStatus,
        int kitchenStatus,
        int paymentStatus,
        int paidAmount)
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(
            seed,
            status: (OrderStatus)orderStatus,
            kitchenStatus: (KitchenStatus)kitchenStatus,
            paymentStatus: (PaymentStatus)paymentStatus,
            paidAmount: paidAmount);
        var client = factory.CreateAuthenticatedClient(seed.WaiterId);
        var itemId = await GetOnlyOrderItemIdAsync(factory, orderId);

        var add = await client.PostAsJsonAsync($"/api/Orders/{orderId}/items", new
        {
            menuItemId = seed.SideItemId,
            quantity = 1,
            notes = "late change"
        });
        var update = await client.PutAsJsonAsync($"/api/Orders/{orderId}/items/{itemId}", new
        {
            quantity = 2,
            notes = "late update"
        });
        var delete = await client.DeleteAsync($"/api/Orders/{orderId}/items/{itemId}");

        Assert.Equal(HttpStatusCode.Conflict, add.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, update.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, delete.StatusCode);
    }

    [Fact]
    public async Task Security_OrderCreateUsesJwtUserIdAndIgnoresBodyUserId()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var client = factory.CreateAuthenticatedClient(seed.WaiterId);

        var response = await client.PostAsJsonAsync("/api/Orders", new
        {
            userId = seed.SaladId,
            customerFirstName = "JWT",
            customerLastName = "Owner",
            notes = "",
            orderType = OrderType.TakeAway,
            tableIds = Array.Empty<int>(),
            items = new[] { new { menuItemId = seed.MainItemId, quantity = 1, notes = "" } }
        });
        var order = await response.Content.ReadFromJsonAsync<OrderResponseDto>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(order);
        Assert.Equal(seed.WaiterId, order.UserId);
        Assert.NotEqual(seed.SaladId, order.UserId);
    }

    [Fact]
    public async Task Concurrency_TwoPaymentsCannotBothOverpay()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var orderId = await factory.CreateOrderAsync(seed);
        var client = factory.CreateAuthenticatedClient(seed.AdminId);
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var first = PostAfterGateAsync(client, gate.Task, "/api/Payments", PaymentRequest(orderId, 70m, Guid.NewGuid()));
        var second = PostAfterGateAsync(client, gate.Task, "/api/Payments", PaymentRequest(orderId, 70m, Guid.NewGuid()));
        gate.SetResult();

        var responses = await Task.WhenAll(first, second);

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.All(responses, response =>
            Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.BadRequest, HttpStatusCode.Conflict }));
        await AssertPaymentTotalsAsync(factory, orderId, expectedCount: 1, expectedPaid: 70m);
    }

    [Fact]
    public async Task Concurrency_TwoOrdersCannotAssignSameTable()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var client = factory.CreateAuthenticatedClient(seed.WaiterId);
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var first = PostAfterGateAsync(client, gate.Task, "/api/Orders", CreateDineInOrderRequest(seed, "A"));
        var second = PostAfterGateAsync(client, gate.Task, "/api/Orders", CreateDineInOrderRequest(seed, "B"));
        gate.SetResult();

        var responses = await Task.WhenAll(first, second);

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.All(responses, response =>
            Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.Conflict }));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var activeAssignments = await db.OrderTables.CountAsync(x =>
            x.TableId == seed.TableOneId &&
            x.Order.Status == OrderStatus.Open);
        Assert.Equal(1, activeAssignments);
    }

    private static object PaymentRequest(int orderId, decimal amount, Guid idempotencyKey) =>
        new
        {
            orderId,
            idempotencyKey,
            amount,
            method = "Cash"
        };

    private static object CreateDineInOrderRequest(TestSeed seed, string suffix) =>
        new
        {
            customerFirstName = $"Guest{suffix}",
            customerLastName = "Concurrent",
            notes = "",
            orderType = OrderType.DineIn,
            tableIds = new[] { seed.TableOneId },
            items = new[] { new { menuItemId = seed.MainItemId, quantity = 1, notes = "" } }
        };

    private static async Task<(HttpResponseMessage Response, CreatePaymentResponseDto? Body)> PostPaymentAsync(
        HttpClient client,
        int orderId,
        decimal amount,
        Guid idempotencyKey)
    {
        var response = await client.PostAsJsonAsync("/api/Payments", PaymentRequest(orderId, amount, idempotencyKey));
        var body = response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<CreatePaymentResponseDto>()
            : null;
        return (response, body);
    }

    private static async Task<HttpResponseMessage> PostAfterGateAsync(
        HttpClient client,
        Task gate,
        string requestUri,
        object payload)
    {
        await gate;
        return await client.PostAsJsonAsync(requestUri, payload);
    }

    private static async Task AssertPaymentTotalsAsync(
        TestWebApplicationFactory factory,
        int orderId,
        int expectedCount,
        decimal expectedPaid)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var payments = await db.Payments.Where(x => x.OrderId == orderId).ToArrayAsync();
        Assert.Equal(expectedCount, payments.Length);
        Assert.Equal(expectedPaid, payments.Sum(x => x.Amount));
    }

    private static async Task<int> GetOnlyOrderItemIdAsync(TestWebApplicationFactory factory, int orderId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.OrderItems
            .Where(x => x.OrderId == orderId)
            .Select(x => x.Id)
            .SingleAsync();
    }
}
