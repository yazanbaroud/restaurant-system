namespace Restaurant.API.DTOs;

public sealed record DailyReportDto(DateOnly Date, decimal Revenue, int OrdersCount, int CompletedOrders, int CancelledOrders);
public sealed record WeeklyReportDto(DateOnly WeekStartDate, DateOnly WeekEndDate, decimal Revenue, int OrdersCount);
public sealed record MonthlyReportDto(int Year, int Month, decimal Revenue, int OrdersCount);
public sealed record YearlyReportDto(int Year, decimal Revenue, int OrdersCount);
public sealed record SalesReportDto(DateOnly From, DateOnly To, decimal Revenue, int OrdersCount, decimal AverageOrderValue);
public sealed record TopDishDto(int MenuItemId, string Name, int QuantitySold, decimal Revenue);
public sealed record LeastOrderedDishDto(int MenuItemId, string Name, int QuantitySold, decimal Revenue);
public sealed record PaymentBreakdownDto(string Method, decimal Amount, int PaymentsCount);
public sealed record PeakHourDto(int Hour, int OrdersCount, decimal Revenue);
public sealed record WaiterPerformanceDto(int? UserId, string WaiterName, int OrdersCount, decimal Revenue);
public sealed record ReservationSummaryDto(int Pending, int Approved, int Rejected, int Cancelled, int Arrived, int NoShow);
public sealed record TableOccupancyDto(int TotalTables, int AvailableTables, int OccupiedTables, int ReservedTables);
public sealed record RevenueComparisonDto(decimal Current, decimal Previous, decimal Difference, decimal PercentageChange);

public sealed record AdminDashboardDto(
    decimal TotalRevenueToday,
    decimal TotalRevenueThisMonth,
    int ActiveOrders,
    int CompletedOrders,
    int CancelledOrders,
    int UnpaidOrders,
    int ReservationsToday,
    int PendingReservations,
    int ApprovedReservations,
    int RejectedReservations,
    int NoShowReservations,
    int OccupiedTables,
    int AvailableTables,
    IReadOnlyCollection<PaymentBreakdownDto> PaymentBreakdown,
    IReadOnlyCollection<TopDishDto> TopSellingDishes,
    IReadOnlyCollection<LeastOrderedDishDto> LeastOrderedDishes,
    IReadOnlyCollection<PeakHourDto> PeakBusinessHours,
    IReadOnlyCollection<WaiterPerformanceDto> WaiterPerformanceSummary,
    decimal AverageOrderValue,
    RevenueComparisonDto DailyComparison,
    RevenueComparisonDto MonthlyComparison);
