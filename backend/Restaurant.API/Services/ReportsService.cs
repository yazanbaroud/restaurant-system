using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class ReportsService(AppDbContext db) : IReportsService
{
    public async Task<DailyReportDto> GetDailyAsync(DateOnly? date, CancellationToken cancellationToken)
    {
        var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var (start, end) = Range(day, day.AddDays(1));
        var orders = db.Orders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var nonCancelledOrders = orders.Where(x => x.Status != OrderStatus.Cancelled);
        return new DailyReportDto(
            day,
            await Revenue(nonCancelledOrders, cancellationToken),
            await nonCancelledOrders.CountAsync(cancellationToken),
            await orders.CountAsync(x => x.Status == OrderStatus.Completed, cancellationToken),
            await orders.CountAsync(x => x.Status == OrderStatus.Cancelled, cancellationToken));
    }

    public async Task<WeeklyReportDto> GetWeeklyAsync(DateOnly? weekStart, CancellationToken cancellationToken)
    {
        var startDay = weekStart ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-(int)DateTime.UtcNow.DayOfWeek);
        var endDay = startDay.AddDays(7);
        var (start, end) = Range(startDay, endDay);
        var orders = db.Orders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var nonCancelledOrders = orders.Where(x => x.Status != OrderStatus.Cancelled);
        return new WeeklyReportDto(startDay, endDay.AddDays(-1), await Revenue(nonCancelledOrders, cancellationToken), await nonCancelledOrders.CountAsync(cancellationToken));
    }

    public async Task<MonthlyReportDto> GetMonthlyAsync(int? year, int? month, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var y = year ?? now.Year;
        var m = month ?? now.Month;
        ValidateYear(y);
        if (m is < 1 or > 12)
        {
            throw new ApiException("Month must be between 1 and 12.");
        }

        var start = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);
        var orders = db.Orders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var nonCancelledOrders = orders.Where(x => x.Status != OrderStatus.Cancelled);
        return new MonthlyReportDto(y, m, await Revenue(nonCancelledOrders, cancellationToken), await nonCancelledOrders.CountAsync(cancellationToken));
    }

    public async Task<YearlyReportDto> GetYearlyAsync(int? year, CancellationToken cancellationToken)
    {
        var y = year ?? DateTime.UtcNow.Year;
        ValidateYear(y);
        var start = new DateTime(y, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddYears(1);
        var orders = db.Orders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var nonCancelledOrders = orders.Where(x => x.Status != OrderStatus.Cancelled);
        return new YearlyReportDto(y, await Revenue(nonCancelledOrders, cancellationToken), await nonCancelledOrders.CountAsync(cancellationToken));
    }

    public async Task<SalesReportDto> GetSalesAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var fromDay = from ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-30);
        var toDay = to ?? DateOnly.FromDateTime(DateTime.UtcNow);
        ValidateDateRange(fromDay, toDay);
        var orders = QueryOrders(fromDay, toDay).Where(x => x.Status != OrderStatus.Cancelled);
        var count = await orders.CountAsync(cancellationToken);
        var revenue = await orders.SumAsync(x => x.TotalPrice, cancellationToken);
        return new SalesReportDto(fromDay, toDay, revenue, count, count == 0 ? 0 : revenue / count);
    }

    public async Task<IReadOnlyCollection<TopDishDto>> GetTopDishesAsync(DateOnly? from, DateOnly? to, int take, CancellationToken cancellationToken) =>
        await DishQuery(from, to).OrderByDescending(x => x.QuantitySold).Take(take).ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyCollection<LeastOrderedDishDto>> GetLeastOrderedAsync(DateOnly? from, DateOnly? to, int take, CancellationToken cancellationToken) =>
        await DishQuery(from, to).OrderBy(x => x.QuantitySold).Take(take)
            .Select(x => new LeastOrderedDishDto(x.MenuItemId, x.Name, x.QuantitySold, x.Revenue))
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyCollection<PaymentBreakdownDto>> GetPaymentBreakdownAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var query = db.Payments.AsNoTracking().AsQueryable();
        if (from.HasValue && to.HasValue)
        {
            ValidateDateRange(from.Value, to.Value);
            var (start, end) = Range(from.Value, to.Value.AddDays(1));
            query = query.Where(x => x.PaidAt >= start && x.PaidAt < end);
        }

        return await query.GroupBy(x => x.Method)
            .Select(x => new PaymentBreakdownDto(x.Key.ToString(), x.Sum(p => p.Amount), x.Count()))
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<PeakHourDto>> GetPeakHoursAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken) =>
        await QueryOrders(from ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-30), to ?? DateOnly.FromDateTime(DateTime.UtcNow))
            .Where(x => x.Status != OrderStatus.Cancelled)
            .GroupBy(x => x.CreatedAt.Hour)
            .Select(x => new PeakHourDto(x.Key, x.Count(), x.Sum(o => o.TotalPrice)))
            .OrderByDescending(x => x.OrdersCount)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyCollection<WaiterPerformanceDto>> GetWaiterPerformanceAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken) =>
        await QueryOrders(from ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-30), to ?? DateOnly.FromDateTime(DateTime.UtcNow))
            .Where(x => x.Status != OrderStatus.Cancelled && x.UserId != null && x.User != null && x.User.Role == UserRole.Waiter)
            .GroupBy(x => new { x.UserId, x.User!.FirstName, x.User.LastName })
            .Select(x => new WaiterPerformanceDto(x.Key.UserId, x.Key.FirstName + " " + x.Key.LastName, x.Count(), x.Sum(o => o.TotalPrice)))
            .ToArrayAsync(cancellationToken);

    public async Task<ReservationSummaryDto> GetReservationsSummaryAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var query = db.Reservations.AsNoTracking().AsQueryable();
        if (from.HasValue && to.HasValue)
        {
            ValidateDateRange(from.Value, to.Value);
            query = query.Where(x => x.ReservationDate >= from.Value && x.ReservationDate <= to.Value);
        }

        return new ReservationSummaryDto(
            await query.CountAsync(x => x.Status == ReservationStatus.Pending, cancellationToken),
            await query.CountAsync(x => x.Status == ReservationStatus.Approved, cancellationToken),
            await query.CountAsync(x => x.Status == ReservationStatus.Rejected, cancellationToken),
            await query.CountAsync(x => x.Status == ReservationStatus.Cancelled, cancellationToken),
            await query.CountAsync(x => x.Status == ReservationStatus.Arrived, cancellationToken),
            await query.CountAsync(x => x.Status == ReservationStatus.NoShow, cancellationToken));
    }

    public async Task<TableOccupancyDto> GetTableOccupancyAsync(CancellationToken cancellationToken) =>
        new(
            await db.Tables.CountAsync(cancellationToken),
            await db.Tables.CountAsync(x => x.Status == TableStatus.Available, cancellationToken),
            await db.Tables.CountAsync(x => x.Status == TableStatus.Occupied, cancellationToken),
            await db.Tables.CountAsync(x => x.Status == TableStatus.Reserved, cancellationToken));

    private IQueryable<Order> QueryOrders(DateOnly from, DateOnly to)
    {
        ValidateDateRange(from, to);
        var (start, end) = Range(from, to.AddDays(1));
        return db.Orders.AsNoTracking().Include(x => x.User).Where(x => x.CreatedAt >= start && x.CreatedAt < end);
    }

    private IQueryable<TopDishDto> DishQuery(DateOnly? from, DateOnly? to)
    {
        var query = db.OrderItems.AsNoTracking().Include(x => x.Order).Include(x => x.MenuItem).AsQueryable();
        if (from.HasValue && to.HasValue)
        {
            ValidateDateRange(from.Value, to.Value);
            var (start, end) = Range(from.Value, to.Value.AddDays(1));
            query = query.Where(x => x.Order.CreatedAt >= start && x.Order.CreatedAt < end);
        }

        query = query.Where(x => x.Order.Status != OrderStatus.Cancelled);

        return query.GroupBy(x => new { x.MenuItemId, x.MenuItem.Name })
            .Select(x => new TopDishDto(x.Key.MenuItemId, x.Key.Name, x.Sum(i => i.Quantity), x.Sum(i => i.Quantity * i.UnitPrice)));
    }

    private static async Task<decimal> Revenue(IQueryable<Order> orders, CancellationToken cancellationToken) =>
        await orders.Where(x => x.Status != OrderStatus.Cancelled).SumAsync(x => x.TotalPrice, cancellationToken);

    private static (DateTime Start, DateTime End) Range(DateOnly from, DateOnly to) =>
        (from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), to.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));

    private static void ValidateDateRange(DateOnly from, DateOnly to)
    {
        if (from > to)
        {
            throw new ApiException("The start date must be before or equal to the end date.");
        }
    }

    private static void ValidateYear(int year)
    {
        if (year is < 1 or > 9999)
        {
            throw new ApiException("Year must be between 1 and 9999.");
        }
    }
}
