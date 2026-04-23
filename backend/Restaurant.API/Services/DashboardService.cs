using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Services;

public sealed class DashboardService(AppDbContext db, IReportsService reports) : IDashboardService
{
    public async Task<AdminDashboardDto> GetAdminDashboardAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var previousDay = today.AddDays(-1);
        var previousMonthStart = monthStart.AddMonths(-1);

        var todaySales = await reports.GetSalesAsync(today, today, cancellationToken);
        var monthSales = await reports.GetSalesAsync(monthStart, today, cancellationToken);
        var previousDaySales = await reports.GetSalesAsync(previousDay, previousDay, cancellationToken);
        var previousMonthSales = await reports.GetSalesAsync(previousMonthStart, monthStart.AddDays(-1), cancellationToken);

        var reservations = db.Reservations.AsNoTracking();
        var tables = db.Tables.AsNoTracking();

        return new AdminDashboardDto(
            todaySales.Revenue,
            monthSales.Revenue,
            await db.Orders.CountAsync(x => x.Status == OrderStatus.InSalads || x.Status == OrderStatus.InMain, cancellationToken),
            await db.Orders.CountAsync(x => x.Status == OrderStatus.Completed, cancellationToken),
            await db.Orders.CountAsync(x => x.Status == OrderStatus.Cancelled, cancellationToken),
            await db.Orders.CountAsync(x => x.PaymentStatus == PaymentStatus.Unpaid, cancellationToken),
            await reservations.CountAsync(x => x.ReservationDate == today, cancellationToken),
            await reservations.CountAsync(x => x.Status == ReservationStatus.Pending, cancellationToken),
            await reservations.CountAsync(x => x.Status == ReservationStatus.Approved, cancellationToken),
            await reservations.CountAsync(x => x.Status == ReservationStatus.Rejected, cancellationToken),
            await reservations.CountAsync(x => x.Status == ReservationStatus.NoShow, cancellationToken),
            await tables.CountAsync(x => x.Status == TableStatus.Occupied, cancellationToken),
            await tables.CountAsync(x => x.Status == TableStatus.Available, cancellationToken),
            await reports.GetPaymentBreakdownAsync(monthStart, today, cancellationToken),
            await reports.GetTopDishesAsync(monthStart, today, 5, cancellationToken),
            await reports.GetLeastOrderedAsync(monthStart, today, 5, cancellationToken),
            await reports.GetPeakHoursAsync(monthStart, today, cancellationToken),
            await reports.GetWaiterPerformanceAsync(monthStart, today, cancellationToken),
            monthSales.AverageOrderValue,
            Compare(todaySales.Revenue, previousDaySales.Revenue),
            Compare(monthSales.Revenue, previousMonthSales.Revenue));
    }

    private static RevenueComparisonDto Compare(decimal current, decimal previous)
    {
        var difference = current - previous;
        var percentage = previous == 0 ? (current == 0 ? 0 : 100) : difference / previous * 100;
        return new RevenueComparisonDto(current, previous, difference, percentage);
    }
}
