using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.AdminOrWaiter)]
public sealed class PaymentsController(IPaymentsService paymentsService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PaymentResponseDto>> Create(CreatePaymentDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await paymentsService.CreateAsync(dto, cancellationToken));

    [HttpGet]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<IReadOnlyCollection<PaymentResponseDto>>> GetAll(
        [FromQuery] DateOnly? date,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken) =>
        Ok(await paymentsService.GetAllAsync(date, from, to, cancellationToken));

    [HttpGet("order/{orderId:int}")]
    public async Task<ActionResult<IReadOnlyCollection<PaymentResponseDto>>> GetByOrder(int orderId, CancellationToken cancellationToken) =>
        Ok(await paymentsService.GetByOrderAsync(orderId, cancellationToken));
}
