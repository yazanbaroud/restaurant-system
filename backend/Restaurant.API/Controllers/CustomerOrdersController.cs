using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/customer")]
[Authorize(Roles = AppRoles.Customer)]
public sealed class CustomerOrdersController(ICustomerOrdersService customerOrdersService) : ControllerBase
{
    [HttpGet("orders")]
    public async Task<ActionResult<IReadOnlyCollection<OrderResponseDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await customerOrdersService.GetAllAsync(User.GetUserId(), cancellationToken));

    [HttpGet("orders/{id:int}")]
    public async Task<ActionResult<OrderResponseDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await customerOrdersService.GetByIdAsync(User.GetUserId(), id, cancellationToken));

    [HttpPost("orders")]
    [EnableRateLimiting(AppRateLimitPolicies.CustomerOrderCreation)]
    public async Task<ActionResult<OrderResponseDto>> Create(CreateCustomerOrderDto dto, CancellationToken cancellationToken)
    {
        var order = await customerOrdersService.CreateAsync(User.GetUserId(), dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    [HttpPut("orders/{id:int}")]
    public async Task<ActionResult<OrderResponseDto>> Update(int id, UpdateCustomerOrderDto dto, CancellationToken cancellationToken) =>
        Ok(await customerOrdersService.UpdateAsync(User.GetUserId(), id, dto, cancellationToken));

    [HttpPost("orders/{id:int}/items")]
    public async Task<ActionResult<OrderResponseDto>> AddItem(int id, CustomerOrderItemInputDto dto, CancellationToken cancellationToken) =>
        Ok(await customerOrdersService.AddItemAsync(User.GetUserId(), id, dto, cancellationToken));

    [HttpPut("orders/{id:int}/items/{itemId:int}")]
    public async Task<ActionResult<OrderResponseDto>> UpdateItem(int id, int itemId, UpdateCustomerOrderItemDto dto, CancellationToken cancellationToken) =>
        Ok(await customerOrdersService.UpdateItemAsync(User.GetUserId(), id, itemId, dto, cancellationToken));

    [HttpDelete("orders/{id:int}/items/{itemId:int}")]
    public async Task<ActionResult<OrderResponseDto>> DeleteItem(int id, int itemId, CancellationToken cancellationToken) =>
        Ok(await customerOrdersService.DeleteItemAsync(User.GetUserId(), id, itemId, cancellationToken));

    [HttpGet("tables/available")]
    public async Task<ActionResult<IReadOnlyCollection<CustomerTableOptionDto>>> GetAvailableTables(CancellationToken cancellationToken) =>
        Ok(await customerOrdersService.GetAvailableTablesAsync(cancellationToken));
}
