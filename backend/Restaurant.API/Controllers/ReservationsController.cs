using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ReservationsController(IReservationsService reservationsService) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting(AppRateLimitPolicies.PublicReservation)]
    public async Task<ActionResult<ReservationResponseDto>> Create(CreateReservationDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await reservationsService.CreateAsync(dto, cancellationToken));

    [HttpGet]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<IReadOnlyCollection<ReservationResponseDto>>> GetAll(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] ReservationStatus? status,
        [FromQuery] string? phoneNumber,
        CancellationToken cancellationToken) =>
        Ok(await reservationsService.GetAllAsync(date, from, to, status, phoneNumber, cancellationToken));

    [HttpGet("paged")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<PagedResponseDto<ReservationResponseDto>>> GetPaged(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] ReservationStatus? status,
        [FromQuery] string? phoneNumber,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default) =>
        Ok(await reservationsService.GetPagedAsync(date, from, to, status, phoneNumber, page, pageSize, cancellationToken));

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<ReservationResponseDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await reservationsService.GetByIdAsync(id, cancellationToken));

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<ReservationResponseDto>> Update(int id, UpdateReservationDto dto, CancellationToken cancellationToken) =>
        Ok(await reservationsService.UpdateAsync(id, dto, cancellationToken));

    [HttpPut("{id:int}/status")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<ReservationResponseDto>> UpdateStatus(int id, UpdateReservationStatusDto dto, CancellationToken cancellationToken) =>
        Ok(await reservationsService.UpdateStatusAsync(id, dto, cancellationToken));

    [HttpPut("{id:int}/approve")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<ReservationResponseDto>> Approve(int id, ReservationDecisionDto dto, CancellationToken cancellationToken) =>
        Ok(await reservationsService.ApproveAsync(id, dto.RestaurantNotes, cancellationToken));

    [HttpPut("{id:int}/reject")]
    [Authorize(Roles = AppRoles.AdminOrManager)]
    public async Task<ActionResult<ReservationResponseDto>> Reject(int id, ReservationDecisionDto dto, CancellationToken cancellationToken) =>
        Ok(await reservationsService.RejectAsync(id, dto.RestaurantNotes, cancellationToken));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await reservationsService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

}
