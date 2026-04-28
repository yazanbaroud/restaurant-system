using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/customer/reservations")]
[Authorize(Roles = AppRoles.Customer)]
public sealed class CustomerReservationsController(IReservationsService reservationsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<ReservationResponseDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await reservationsService.GetForCustomerAsync(User.GetUserId(), cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ReservationResponseDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await reservationsService.GetForCustomerByIdAsync(User.GetUserId(), id, cancellationToken));

    [HttpPut("{id:int}/cancel")]
    public async Task<ActionResult<ReservationResponseDto>> Cancel(int id, CancellationToken cancellationToken) =>
        Ok(await reservationsService.CancelForCustomerAsync(User.GetUserId(), id, cancellationToken));
}
