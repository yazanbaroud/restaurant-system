using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Models;
using Restaurant.API.Tests.Infrastructure;

namespace Restaurant.API.Tests;

public sealed class ReportingFinancialTests
{
    [Fact]
    public async Task Revenue_ExcludesUnpaidOrders()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.MainItemId, 10, 100m)],
            paymentStatus: PaymentStatus.Unpaid);
        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.SideItemId, 1, 25m)],
            paymentStatus: PaymentStatus.Paid,
            paidAmount: 25m,
            paidAt: now);

        var sales = await GetSalesAsync(admin, today);
        var dashboard = await admin.GetFromJsonAsync<AdminDashboardDto>("/api/Dashboard/admin");

        Assert.Equal(25m, sales.Revenue);
        Assert.Equal(1, sales.OrdersCount);
        Assert.NotNull(dashboard);
        Assert.Equal(25m, dashboard.TotalRevenueToday);
    }

    [Fact]
    public async Task Revenue_CountsPartialPayments()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.MainItemId, 1, 100m)],
            paymentStatus: PaymentStatus.Partial,
            paidAmount: 40m,
            paidAt: now);

        var sales = await GetSalesAsync(admin, today);
        var daily = await admin.GetFromJsonAsync<DailyReportDto>($"/api/Reports/daily?date={DateQuery(today)}");
        var breakdown = await admin.GetFromJsonAsync<PaymentBreakdownDto[]>($"/api/Reports/payment-breakdown?from={DateQuery(today)}&to={DateQuery(today)}");

        Assert.Equal(40m, sales.Revenue);
        Assert.Equal(1, sales.OrdersCount);
        Assert.Equal(40m, sales.AverageOrderValue);
        Assert.NotNull(daily);
        Assert.Equal(40m, daily.Revenue);
        var cash = Assert.Single(breakdown ?? []);
        Assert.Equal("Cash", cash.Method);
        Assert.Equal(40m, cash.Amount);
        Assert.Equal(1, cash.PaymentsCount);
    }

    [Fact]
    public async Task Revenue_ExcludesCancelledOrders()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.MainItemId, 1, 100m)],
            status: OrderStatus.Cancelled,
            paymentStatus: PaymentStatus.Partial,
            paidAmount: 40m,
            paidAt: now);

        var sales = await GetSalesAsync(admin, today);
        var daily = await admin.GetFromJsonAsync<DailyReportDto>($"/api/Reports/daily?date={DateQuery(today)}");

        Assert.Equal(0m, sales.Revenue);
        Assert.Equal(0, sales.OrdersCount);
        Assert.NotNull(daily);
        Assert.Equal(0m, daily.Revenue);
        Assert.Equal(1, daily.CancelledOrders);
    }

    [Fact]
    public async Task CancelledUnpaidOrder_DoesNotCountAsRevenueOrOpenDebt()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.MainItemId, 1, 100m)],
            paymentStatus: PaymentStatus.Unpaid);
        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.SideItemId, 1, 25m)],
            status: OrderStatus.Cancelled,
            paymentStatus: PaymentStatus.Unpaid);
        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.SideItemId, 1, 25m)],
            status: OrderStatus.Completed,
            paymentStatus: PaymentStatus.Unpaid);

        var sales = await GetSalesAsync(admin, today);
        var dashboard = await admin.GetFromJsonAsync<AdminDashboardDto>("/api/Dashboard/admin");

        Assert.Equal(0m, sales.Revenue);
        Assert.Equal(0, sales.OrdersCount);
        Assert.NotNull(dashboard);
        Assert.Equal(1, dashboard.UnpaidOrders);
    }

    [Fact]
    public async Task RefundedCancelledOrder_SubtractsRevenue()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.MainItemId, 1, 100m)],
            status: OrderStatus.Cancelled,
            paymentStatus: PaymentStatus.Refunded,
            paidAmount: 40m,
            paidAt: now);

        var sales = await GetSalesAsync(admin, today);
        var breakdown = await admin.GetFromJsonAsync<PaymentBreakdownDto[]>($"/api/Reports/payment-breakdown?from={DateQuery(today)}&to={DateQuery(today)}");

        Assert.Equal(-40m, sales.Revenue);
        Assert.Equal(1, sales.OrdersCount);
        var cash = Assert.Single(breakdown ?? []);
        Assert.Equal(-40m, cash.Amount);
    }

    [Fact]
    public async Task PaymentBasedAggregation_UsesPaymentDateAndPaidItems()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        await CreateReportedOrderAsync(
            factory,
            seed,
            now.AddDays(-3),
            [new ReportItem(seed.MainItemId, 2, 50m)],
            kitchenStatus: KitchenStatus.Served,
            paymentStatus: PaymentStatus.Partial,
            paidAmount: 50m,
            paidAt: now);
        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.SideItemId, 10, 25m)],
            paymentStatus: PaymentStatus.Unpaid);

        var sales = await GetSalesAsync(admin, today);
        var daily = await admin.GetFromJsonAsync<DailyReportDto>($"/api/Reports/daily?date={DateQuery(today)}");
        var topDishes = await admin.GetFromJsonAsync<TopDishDto[]>($"/api/Reports/top-dishes?from={DateQuery(today)}&to={DateQuery(today)}&take=10");

        Assert.Equal(50m, sales.Revenue);
        Assert.Equal(1, sales.OrdersCount);
        Assert.Equal(1m, sales.ItemsSold);
        Assert.NotNull(daily);
        Assert.Equal(50m, daily.Revenue);
        var dish = Assert.Single(topDishes ?? []);
        Assert.Equal(seed.MainItemId, dish.MenuItemId);
        Assert.Equal(1m, dish.QuantitySold);
        Assert.Equal(50m, dish.Revenue);
    }

    [Fact]
    public async Task TopItems_ExcludeUnpaidOrders()
    {
        using var factory = new TestWebApplicationFactory();
        var seed = await factory.ResetDatabaseAsync();
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var admin = factory.CreateAuthenticatedClient(seed.AdminId);

        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.MainItemId, 1, 100m)],
            paymentStatus: PaymentStatus.Paid,
            paidAmount: 100m,
            paidAt: now);
        await CreateReportedOrderAsync(
            factory,
            seed,
            now,
            [new ReportItem(seed.SideItemId, 20, 25m)],
            paymentStatus: PaymentStatus.Unpaid);

        var topDishes = await admin.GetFromJsonAsync<TopDishDto[]>($"/api/Reports/top-dishes?from={DateQuery(today)}&to={DateQuery(today)}&take=10");

        var dish = Assert.Single(topDishes ?? []);
        Assert.Equal(seed.MainItemId, dish.MenuItemId);
        Assert.Equal(1m, dish.QuantitySold);
        Assert.Equal(100m, dish.Revenue);
    }

    private static async Task<SalesReportDto> GetSalesAsync(HttpClient client, DateOnly day)
    {
        var response = await client.GetAsync($"/api/Reports/sales?from={DateQuery(day)}&to={DateQuery(day)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<SalesReportDto>()
            ?? throw new InvalidOperationException("Sales report response was empty.");
    }

    private static async Task<int> CreateReportedOrderAsync(
        TestWebApplicationFactory factory,
        TestSeed seed,
        DateTime orderCreatedAt,
        IReadOnlyCollection<ReportItem> items,
        OrderStatus status = OrderStatus.Open,
        KitchenStatus kitchenStatus = KitchenStatus.New,
        PaymentStatus paymentStatus = PaymentStatus.Unpaid,
        decimal paidAmount = 0,
        DateTime? paidAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var order = new Order
        {
            UserId = seed.WaiterId,
            CustomerFirstName = "Report",
            CustomerLastName = "Case",
            CreatedAt = DateTime.SpecifyKind(orderCreatedAt, DateTimeKind.Utc),
            OrderNumber = $"R-{Guid.NewGuid():N}",
            Status = status,
            KitchenStatus = kitchenStatus,
            PaymentStatus = paymentStatus,
            OrderType = OrderType.TakeAway,
            TotalAmount = items.Sum(x => x.Quantity * x.UnitPrice)
        };

        foreach (var item in items)
        {
            order.Items.Add(new OrderItem
            {
                MenuItemId = item.MenuItemId,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice
            });
        }

        if (paidAmount > 0)
        {
            order.Payments.Add(new Payment
            {
                Amount = paidAmount,
                Method = PaymentMethod.Cash,
                CreatedAt = DateTime.SpecifyKind(paidAt ?? orderCreatedAt, DateTimeKind.Utc),
                CreatedByUserId = seed.WaiterId,
                IdempotencyKey = Guid.NewGuid()
            });
        }

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return order.Id;
    }

    private static string DateQuery(DateOnly date) =>
        date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private sealed record ReportItem(int MenuItemId, int Quantity, decimal UnitPrice);
}
