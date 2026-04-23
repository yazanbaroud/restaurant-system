using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class ReportsController(IReportsService reportsService) : ControllerBase
{
    [HttpGet("daily")]
    public async Task<ActionResult<DailyReportDto>> Daily([FromQuery] DateOnly? date, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetDailyAsync(date, cancellationToken));

    [HttpGet("weekly")]
    public async Task<ActionResult<WeeklyReportDto>> Weekly([FromQuery] DateOnly? weekStart, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetWeeklyAsync(weekStart, cancellationToken));

    [HttpGet("monthly")]
    public async Task<ActionResult<MonthlyReportDto>> Monthly([FromQuery] int? year, [FromQuery] int? month, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetMonthlyAsync(year, month, cancellationToken));

    [HttpGet("yearly")]
    public async Task<ActionResult<YearlyReportDto>> Yearly([FromQuery] int? year, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetYearlyAsync(year, cancellationToken));

    [HttpGet("sales")]
    public async Task<ActionResult<SalesReportDto>> Sales([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetSalesAsync(from, to, cancellationToken));

    [HttpGet("top-dishes")]
    public async Task<ActionResult<IReadOnlyCollection<TopDishDto>>> TopDishes([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int take = 10, CancellationToken cancellationToken = default) =>
        Ok(await reportsService.GetTopDishesAsync(from, to, Math.Clamp(take, 1, 50), cancellationToken));

    [HttpGet("least-ordered")]
    public async Task<ActionResult<IReadOnlyCollection<LeastOrderedDishDto>>> LeastOrdered([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int take = 10, CancellationToken cancellationToken = default) =>
        Ok(await reportsService.GetLeastOrderedAsync(from, to, Math.Clamp(take, 1, 50), cancellationToken));

    [HttpGet("payment-breakdown")]
    public async Task<ActionResult<IReadOnlyCollection<PaymentBreakdownDto>>> PaymentBreakdown([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetPaymentBreakdownAsync(from, to, cancellationToken));

    [HttpGet("peak-hours")]
    public async Task<ActionResult<IReadOnlyCollection<PeakHourDto>>> PeakHours([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetPeakHoursAsync(from, to, cancellationToken));

    [HttpGet("waiter-performance")]
    public async Task<ActionResult<IReadOnlyCollection<WaiterPerformanceDto>>> WaiterPerformance([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetWaiterPerformanceAsync(from, to, cancellationToken));

    [HttpGet("reservations-summary")]
    public async Task<ActionResult<ReservationSummaryDto>> ReservationsSummary([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetReservationsSummaryAsync(from, to, cancellationToken));

    [HttpGet("table-occupancy")]
    public async Task<ActionResult<TableOccupancyDto>> TableOccupancy(CancellationToken cancellationToken) =>
        Ok(await reportsService.GetTableOccupancyAsync(cancellationToken));
}
