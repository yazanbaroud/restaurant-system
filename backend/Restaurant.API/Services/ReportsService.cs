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
    private static readonly TimeZoneInfo BusinessTimeZone = TimeZoneInfo.Utc;

    public async Task<DailyReportDto> GetDailyAsync(DateOnly? date, CancellationToken cancellationToken)
    {
        var day = date ?? CurrentBusinessDay();
        var payments = QueryPayments(day, day);
        var orders = QueryOrdersCreatedDuring(day, day);

        return new DailyReportDto(
            day,
            await NetRevenueAsync(payments, cancellationToken),
            await PaidOrderCountAsync(payments, cancellationToken),
            await orders.CountAsync(x => x.Status == OrderStatus.Completed, cancellationToken),
            await orders.CountAsync(x => x.Status == OrderStatus.Cancelled, cancellationToken));
    }

    public async Task<DailySummaryReportDto> GetDailySummaryAsync(DateOnly? date, CancellationToken cancellationToken)
    {
        var day = date ?? CurrentBusinessDay();
        var (start, end) = BusinessRange(day, day.AddDays(1));
        var orders = QueryOrdersCreatedDuring(day, day);
        var payments = db.Payments.AsNoTracking()
            .Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var refunds = db.PaymentRefunds.AsNoTracking()
            .Where(x => x.RefundedAt >= start && x.RefundedAt < end);

        var paymentRows = await payments
            .GroupBy(x => x.Method)
            .Select(x => new MethodAmountRow(x.Key, x.Sum(p => p.Amount)))
            .ToArrayAsync(cancellationToken);
        var refundRows = await refunds
            .GroupBy(x => x.Method)
            .Select(x => new MethodAmountRow(x.Key, x.Sum(p => p.Amount)))
            .ToArrayAsync(cancellationToken);

        var cashRevenue = RevenueFor(PaymentMethod.Cash, paymentRows, refundRows);
        var creditManualRevenue = RevenueFor(PaymentMethod.CreditManual, paymentRows, refundRows);
        var otherRevenue = RevenueFor(PaymentMethod.Other, paymentRows, refundRows);

        return new DailySummaryReportDto(
            day,
            await orders.CountAsync(cancellationToken),
            NormalizeMoney(cashRevenue + creditManualRevenue + otherRevenue),
            cashRevenue,
            creditManualRevenue,
            otherRevenue,
            await orders.CountAsync(x =>
                x.Status == OrderStatus.Open &&
                (x.PaymentStatus == PaymentStatus.Unpaid || x.PaymentStatus == PaymentStatus.PartiallyPaid),
                cancellationToken),
            await orders.CountAsync(x => x.Status == OrderStatus.Cancelled, cancellationToken));
    }

    public async Task<WeeklyReportDto> GetWeeklyAsync(DateOnly? weekStart, CancellationToken cancellationToken)
    {
        var currentBusinessDay = CurrentBusinessDay();
        var startDay = weekStart ?? currentBusinessDay.AddDays(-(int)currentBusinessDay.DayOfWeek);
        var endDay = startDay.AddDays(6);
        var payments = QueryPayments(startDay, endDay);

        return new WeeklyReportDto(
            startDay,
            endDay,
            await NetRevenueAsync(payments, cancellationToken),
            await PaidOrderCountAsync(payments, cancellationToken));
    }

    public async Task<MonthlyReportDto> GetMonthlyAsync(int? year, int? month, CancellationToken cancellationToken)
    {
        var today = CurrentBusinessDay();
        var y = year ?? today.Year;
        var m = month ?? today.Month;
        ValidateYear(y);
        if (m is < 1 or > 12)
        {
            throw new ApiException("החודש חייב להיות בין 1 ל־12.");
        }

        var startDay = new DateOnly(y, m, 1);
        var endDay = startDay.AddMonths(1).AddDays(-1);
        var payments = QueryPayments(startDay, endDay);

        return new MonthlyReportDto(
            y,
            m,
            await NetRevenueAsync(payments, cancellationToken),
            await PaidOrderCountAsync(payments, cancellationToken));
    }

    public async Task<YearlyReportDto> GetYearlyAsync(int? year, CancellationToken cancellationToken)
    {
        var y = year ?? CurrentBusinessDay().Year;
        ValidateYear(y);
        var startDay = new DateOnly(y, 1, 1);
        var endDay = new DateOnly(y, 12, 31);
        var payments = QueryPayments(startDay, endDay);

        return new YearlyReportDto(
            y,
            await NetRevenueAsync(payments, cancellationToken),
            await PaidOrderCountAsync(payments, cancellationToken));
    }

    public async Task<SalesReportDto> GetSalesAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var today = CurrentBusinessDay();
        var fromDay = from ?? today.AddDays(-30);
        var toDay = to ?? today;
        ValidateDateRange(fromDay, toDay);

        var payments = QueryPayments(fromDay, toDay);
        var ordersCount = await PaidOrderCountAsync(payments, cancellationToken);
        var revenue = await NetRevenueAsync(payments, cancellationToken);
        var dishTotals = await PaidDishTotalsAsync(fromDay, toDay, cancellationToken);
        var itemsSold = NormalizeQuantity(dishTotals.Sum(x => x.QuantitySold));

        return new SalesReportDto(
            fromDay,
            toDay,
            revenue,
            ordersCount,
            ordersCount == 0 ? 0 : revenue / ordersCount,
            itemsSold);
    }

    public async Task<IReadOnlyCollection<TopDishDto>> GetTopDishesAsync(DateOnly? from, DateOnly? to, int take, CancellationToken cancellationToken)
    {
        var dishes = await PaidDishTotalsAsync(from, to, cancellationToken);

        return dishes
            .OrderByDescending(x => x.QuantitySold)
            .ThenByDescending(x => x.Revenue)
            .Take(take)
            .Select(x => new TopDishDto(x.MenuItemId, x.Name, x.QuantitySold, x.Revenue))
            .ToArray();
    }

    public async Task<IReadOnlyCollection<LeastOrderedDishDto>> GetLeastOrderedAsync(DateOnly? from, DateOnly? to, int take, CancellationToken cancellationToken)
    {
        var dishes = await PaidDishTotalsAsync(from, to, cancellationToken);

        return dishes
            .OrderBy(x => x.QuantitySold)
            .ThenBy(x => x.Revenue)
            .Take(take)
            .Select(x => new LeastOrderedDishDto(x.MenuItemId, x.Name, x.QuantitySold, x.Revenue))
            .ToArray();
    }

    public async Task<IReadOnlyCollection<PaymentBreakdownDto>> GetPaymentBreakdownAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var query = QueryPayments(from, to);
        if (UseClientDecimalAggregation())
        {
            var paymentRows = await query
                .Select(x => new PaymentBreakdownRow(x.Method, x.Amount, x.Order.PaymentStatus))
                .ToArrayAsync(cancellationToken);

            return paymentRows
                .GroupBy(x => x.Method)
                .Select(x => new PaymentBreakdownDto(
                    x.Key.ToString(),
                    NormalizeMoney(x.Sum(p => SignedAmount(p.Amount, p.PaymentStatus))),
                    x.Count()))
                .ToArray();
        }

        var rows = await query
            .GroupBy(x => x.Method)
            .Select(x => new
            {
                Method = x.Key,
                Amount = x.Sum(p => p.Order.PaymentStatus == PaymentStatus.Refunded ? -p.Amount : p.Amount),
                PaymentsCount = x.Count()
            })
            .ToArrayAsync(cancellationToken);

        return rows
            .Select(x => new PaymentBreakdownDto(x.Method.ToString(), NormalizeMoney(x.Amount), x.PaymentsCount))
            .ToArray();
    }

    public async Task<IReadOnlyCollection<PeakHourDto>> GetPeakHoursAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var today = CurrentBusinessDay();
        var rows = await QueryPayments(from ?? today.AddDays(-30), to ?? today)
            .Select(x => new PaymentTimeRow(x.OrderId, x.CreatedAt, x.Amount, x.Order.PaymentStatus))
            .ToArrayAsync(cancellationToken);

        return rows
            .GroupBy(x => BusinessHour(x.CreatedAt))
            .Select(x => new PeakHourDto(
                x.Key,
                x.Select(p => p.OrderId).Distinct().Count(),
                NormalizeMoney(x.Sum(p => SignedAmount(p.Amount, p.PaymentStatus)))))
            .OrderByDescending(x => x.OrdersCount)
            .ThenByDescending(x => x.Revenue)
            .ToArray();
    }

    public async Task<IReadOnlyCollection<WaiterPerformanceDto>> GetWaiterPerformanceAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var today = CurrentBusinessDay();
        var rows = await QueryPayments(from ?? today.AddDays(-30), to ?? today)
            .Where(x => x.Order.UserId != null && x.Order.User != null && x.Order.User.Role == UserRole.Waiter)
            .Select(x => new WaiterPaymentRow(
                x.Order.UserId,
                x.Order.User!.FirstName,
                x.Order.User.LastName,
                x.OrderId,
                x.Amount,
                x.Order.PaymentStatus))
            .ToArrayAsync(cancellationToken);

        return rows
            .GroupBy(x => new { x.UserId, x.FirstName, x.LastName })
            .Select(x => new WaiterPerformanceDto(
                x.Key.UserId,
                $"{x.Key.FirstName} {x.Key.LastName}".Trim(),
                x.Select(p => p.OrderId).Distinct().Count(),
                NormalizeMoney(x.Sum(p => SignedAmount(p.Amount, p.PaymentStatus)))))
            .OrderByDescending(x => x.Revenue)
            .ToArray();
    }

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

    private IQueryable<Payment> QueryPayments(DateOnly from, DateOnly to)
    {
        ValidateDateRange(from, to);
        var (start, end) = BusinessRange(from, to.AddDays(1));

        return QueryValidCompletedPayments()
            .Where(x => x.CreatedAt >= start && x.CreatedAt < end);
    }

    private IQueryable<Payment> QueryPayments(DateOnly? from, DateOnly? to)
    {
        var query = QueryValidCompletedPayments();
        if (!from.HasValue || !to.HasValue)
        {
            return query;
        }

        ValidateDateRange(from.Value, to.Value);
        var (start, end) = BusinessRange(from.Value, to.Value.AddDays(1));
        return query.Where(x => x.CreatedAt >= start && x.CreatedAt < end);
    }

    private IQueryable<Payment> QueryValidCompletedPayments() =>
        db.Payments
            .AsNoTracking()
            .Where(x => x.Amount > 0)
            .Where(x =>
                x.Order.PaymentStatus == PaymentStatus.Paid ||
                x.Order.PaymentStatus == PaymentStatus.Partial ||
                x.Order.PaymentStatus == PaymentStatus.Refunded)
            .Where(x => x.Order.Status != OrderStatus.Cancelled || x.Order.PaymentStatus == PaymentStatus.Refunded);

    private IQueryable<Order> QueryOrdersCreatedDuring(DateOnly from, DateOnly to)
    {
        ValidateDateRange(from, to);
        var (start, end) = BusinessRange(from, to.AddDays(1));

        return db.Orders
            .AsNoTracking()
            .Where(x => x.CreatedAt >= start && x.CreatedAt < end);
    }

    private async Task<IReadOnlyCollection<DishTotalRow>> PaidDishTotalsAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var paymentRows = await QueryPayments(from, to)
            .Select(x => new PaymentAggregationRow(x.OrderId, x.Amount, x.Order.PaymentStatus))
            .ToArrayAsync(cancellationToken);

        return await PaidDishTotalsAsync(paymentRows, cancellationToken);
    }

    private async Task<IReadOnlyCollection<DishTotalRow>> PaidDishTotalsAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var paymentRows = await QueryPayments(from, to)
            .Select(x => new PaymentAggregationRow(x.OrderId, x.Amount, x.Order.PaymentStatus))
            .ToArrayAsync(cancellationToken);

        return await PaidDishTotalsAsync(paymentRows, cancellationToken);
    }

    private async Task<IReadOnlyCollection<DishTotalRow>> PaidDishTotalsAsync(
        IReadOnlyCollection<PaymentAggregationRow> paymentRows,
        CancellationToken cancellationToken)
    {
        var paidByOrder = paymentRows
            .GroupBy(x => x.OrderId)
            .Select(x => new
            {
                OrderId = x.Key,
                NetPaidAmount = NormalizeMoney(x.Sum(p => SignedAmount(p.Amount, p.PaymentStatus)))
            })
            .Where(x => x.NetPaidAmount != 0)
            .ToDictionary(x => x.OrderId, x => x.NetPaidAmount);

        if (paidByOrder.Count == 0)
        {
            return Array.Empty<DishTotalRow>();
        }

        var orderIds = paidByOrder.Keys.ToArray();
        var items = await db.OrderItems
            .AsNoTracking()
            .Where(x => orderIds.Contains(x.OrderId))
            .Select(x => new OrderItemAggregationRow(
                x.OrderId,
                x.MenuItemId,
                x.MenuItem.Name,
                x.Quantity,
                x.UnitPrice))
            .ToArrayAsync(cancellationToken);

        var orderLineTotals = items
            .GroupBy(x => x.OrderId)
            .ToDictionary(x => x.Key, x => x.Sum(i => i.LineTotal));

        var dishes = new Dictionary<int, DishTotalRow>();
        foreach (var item in items)
        {
            if (!paidByOrder.TryGetValue(item.OrderId, out var netPaidAmount) ||
                !orderLineTotals.TryGetValue(item.OrderId, out var orderLineTotal) ||
                orderLineTotal <= 0)
            {
                continue;
            }

            var paidRatio = PaidRatio(netPaidAmount, orderLineTotal);
            if (paidRatio == 0)
            {
                continue;
            }

            if (!dishes.TryGetValue(item.MenuItemId, out var dish))
            {
                dish = new DishTotalRow
                {
                    MenuItemId = item.MenuItemId,
                    Name = item.Name
                };
                dishes.Add(item.MenuItemId, dish);
            }

            dish.QuantitySold += item.Quantity * paidRatio;
            dish.Revenue += item.LineTotal * paidRatio;
        }

        return dishes.Values
            .Where(x => x.QuantitySold != 0 || x.Revenue != 0)
            .Select(x =>
            {
                x.QuantitySold = NormalizeQuantity(x.QuantitySold);
                x.Revenue = NormalizeMoney(x.Revenue);
                return x;
            })
            .ToArray();
    }

    private static Task<int> PaidOrderCountAsync(IQueryable<Payment> payments, CancellationToken cancellationToken) =>
        payments.Select(x => x.OrderId).Distinct().CountAsync(cancellationToken);

    private async Task<decimal> NetRevenueAsync(IQueryable<Payment> payments, CancellationToken cancellationToken)
    {
        if (UseClientDecimalAggregation())
        {
            var rows = await payments
                .Select(x => new PaymentAmountRow(x.Amount, x.Order.PaymentStatus))
                .ToArrayAsync(cancellationToken);

            return NormalizeMoney(rows.Sum(x => SignedAmount(x.Amount, x.PaymentStatus)));
        }

        var revenue = await payments.SumAsync(
            x => x.Order.PaymentStatus == PaymentStatus.Refunded ? -x.Amount : x.Amount,
            cancellationToken);

        return NormalizeMoney(revenue);
    }

    private static decimal SignedAmount(decimal amount, PaymentStatus paymentStatus) =>
        paymentStatus == PaymentStatus.Refunded ? -amount : amount;

    private static decimal RevenueFor(
        PaymentMethod method,
        IEnumerable<MethodAmountRow> paymentRows,
        IEnumerable<MethodAmountRow> refundRows)
    {
        var payments = paymentRows.Where(x => x.Method == method).Sum(x => x.Amount);
        var refunds = refundRows.Where(x => x.Method == method).Sum(x => x.Amount);
        return NormalizeMoney(payments - refunds);
    }

    private static decimal PaidRatio(decimal netPaidAmount, decimal orderLineTotal)
    {
        if (orderLineTotal <= 0)
        {
            return 0;
        }

        var ratio = netPaidAmount / orderLineTotal;
        return Math.Clamp(ratio, -1m, 1m);
    }

    private static (DateTime Start, DateTime End) BusinessRange(DateOnly from, DateOnly toExclusive) =>
        (BusinessDateStartUtc(from), BusinessDateStartUtc(toExclusive));

    private static DateTime BusinessDateStartUtc(DateOnly date)
    {
        var localStart = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localStart, BusinessTimeZone);
    }

    private static DateOnly CurrentBusinessDay() =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessTimeZone));

    private static int BusinessHour(DateTime value) =>
        TimeZoneInfo.ConvertTimeFromUtc(AsUtc(value), BusinessTimeZone).Hour;

    private static DateTime AsUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    private static decimal NormalizeMoney(decimal amount) =>
        decimal.Round(amount, 2, MidpointRounding.AwayFromZero);

    private static decimal NormalizeQuantity(decimal quantity) =>
        decimal.Round(quantity, 4, MidpointRounding.AwayFromZero);

    private bool UseClientDecimalAggregation() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.Sqlite", StringComparison.Ordinal);

    private static void ValidateDateRange(DateOnly from, DateOnly to)
    {
        if (from > to)
        {
            throw new ApiException("תאריך ההתחלה חייב להיות לפני תאריך הסיום או זהה לו.");
        }
    }

    private static void ValidateYear(int year)
    {
        if (year is < 1 or > 9999)
        {
            throw new ApiException("השנה אינה תקינה.");
        }
    }

    private sealed record PaymentAggregationRow(int OrderId, decimal Amount, PaymentStatus PaymentStatus);

    private sealed record PaymentAmountRow(decimal Amount, PaymentStatus PaymentStatus);

    private sealed record PaymentBreakdownRow(PaymentMethod Method, decimal Amount, PaymentStatus PaymentStatus);

    private sealed record PaymentTimeRow(int OrderId, DateTime CreatedAt, decimal Amount, PaymentStatus PaymentStatus);

    private sealed record WaiterPaymentRow(
        int? UserId,
        string FirstName,
        string LastName,
        int OrderId,
        decimal Amount,
        PaymentStatus PaymentStatus);

    private sealed record MethodAmountRow(PaymentMethod Method, decimal Amount);

    private sealed record OrderItemAggregationRow(
        int OrderId,
        int MenuItemId,
        string Name,
        int Quantity,
        decimal UnitPrice)
    {
        public decimal LineTotal => Quantity * UnitPrice;
    }

    private sealed class DishTotalRow
    {
        public int MenuItemId { get; set; }

        public string Name { get; set; } = string.Empty;

        public decimal QuantitySold { get; set; }

        public decimal Revenue { get; set; }
    }
}
