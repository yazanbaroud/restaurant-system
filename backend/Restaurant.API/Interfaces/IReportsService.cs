using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IReportsService
{
    Task<DailyReportDto> GetDailyAsync(DateOnly? date, CancellationToken cancellationToken);
    Task<WeeklyReportDto> GetWeeklyAsync(DateOnly? weekStart, CancellationToken cancellationToken);
    Task<MonthlyReportDto> GetMonthlyAsync(int? year, int? month, CancellationToken cancellationToken);
    Task<YearlyReportDto> GetYearlyAsync(int? year, CancellationToken cancellationToken);
    Task<SalesReportDto> GetSalesAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<TopDishDto>> GetTopDishesAsync(DateOnly? from, DateOnly? to, int take, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<LeastOrderedDishDto>> GetLeastOrderedAsync(DateOnly? from, DateOnly? to, int take, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<PaymentBreakdownDto>> GetPaymentBreakdownAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<PeakHourDto>> GetPeakHoursAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<WaiterPerformanceDto>> GetWaiterPerformanceAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken);
    Task<ReservationSummaryDto> GetReservationsSummaryAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken);
    Task<TableOccupancyDto> GetTableOccupancyAsync(CancellationToken cancellationToken);
}
