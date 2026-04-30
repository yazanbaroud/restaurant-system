using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.AdminOrWaiter)]
public sealed class OrdersController(IOrdersService ordersService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OrderResponseDto>> Create(CreateOrderDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await ordersService.CreateAsync(User.GetUserId(), dto, cancellationToken));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<OrderResponseDto>>> GetAll(
        [FromQuery] OrderStatus? status,
        [FromQuery] KitchenStatus? kitchenStatus,
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] PaymentStatus? paymentStatus,
        [FromQuery] OrderType? orderType,
        CancellationToken cancellationToken) =>
        Ok(await ordersService.GetAllAsync(status, kitchenStatus, date, from, to, paymentStatus, orderType, IsWaiterOnly(), cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderResponseDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.GetByIdAsync(id, IsWaiterOnly(), cancellationToken));

    [HttpPut("{id:int}")]
    public async Task<ActionResult<OrderResponseDto>> Update(int id, UpdateOrderDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.UpdateAsync(id, dto, cancellationToken));

    [HttpPost("{id:int}/advance-kitchen-status")]
    public async Task<ActionResult<OrderResponseDto>> AdvanceKitchenStatus(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.AdvanceKitchenStatusAsync(id, User.GetUserId(), cancellationToken));

    [HttpPost("{id:int}/mark-paid")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<OrderResponseDto>> MarkPaid(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.MarkPaidAsync(id, User.GetUserId(), cancellationToken));

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<OrderResponseDto>> Cancel(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.CancelAsync(id, User.GetUserId(), cancellationToken));

    [HttpPost("{id:int}/items")]
    public async Task<ActionResult<OrderResponseDto>> AddItem(int id, AddOrderItemDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.AddItemAsync(id, dto, cancellationToken));

    [HttpPut("{id:int}/items/{itemId:int}")]
    public async Task<ActionResult<OrderResponseDto>> UpdateItem(int id, int itemId, UpdateOrderItemDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.UpdateItemAsync(id, itemId, dto, cancellationToken));

    [HttpDelete("{id:int}/items/{itemId:int}")]
    public async Task<ActionResult<OrderResponseDto>> DeleteItem(int id, int itemId, CancellationToken cancellationToken) =>
        Ok(await ordersService.DeleteItemAsync(id, itemId, cancellationToken));

    [HttpPut("{id:int}/tables")]
    public async Task<ActionResult<OrderResponseDto>> UpdateTables(int id, UpdateOrderTablesDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.UpdateTablesAsync(id, dto, cancellationToken));

    private bool IsWaiterOnly() =>
        User.IsInRole(AppRoles.Waiter) && !User.IsInRole(AppRoles.Admin);
}
