using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.AdminOrWaiterOrKitchenOrSalad)]
public sealed class OrdersController(IOrdersService ordersService) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> Create(CreateOrderDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await ordersService.CreateAsync(User.GetUserId(), dto, cancellationToken));

    [HttpGet]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
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

    [HttpGet("paged")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<PagedResponseDto<OrderResponseDto>>> GetPaged(
        [FromQuery] OrderStatus? status,
        [FromQuery] KitchenStatus? kitchenStatus,
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] PaymentStatus? paymentStatus,
        [FromQuery] OrderType? orderType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default) =>
        Ok(await ordersService.GetPagedAsync(status, kitchenStatus, date, from, to, paymentStatus, orderType, IsWaiterOnly(), page, pageSize, cancellationToken));

    [HttpGet("salads")]
    [Authorize(Roles = AppRoles.AdminOrSalad)]
    public async Task<ActionResult<IReadOnlyCollection<OrderResponseDto>>> GetSalads(CancellationToken cancellationToken) =>
        Ok(await ordersService.GetSaladsAsync(cancellationToken));

    [HttpGet("kitchen")]
    [Authorize(Roles = AppRoles.AdminOrKitchen)]
    public async Task<ActionResult<IReadOnlyCollection<OrderResponseDto>>> GetKitchen(CancellationToken cancellationToken) =>
        Ok(await ordersService.GetKitchenAsync(cancellationToken));

    [HttpGet("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.GetByIdAsync(id, IsWaiterOnly(), cancellationToken));

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> Update(int id, UpdateOrderDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.UpdateAsync(id, dto, cancellationToken));

    [HttpPost("{id:int}/advance-salad-status")]
    [Authorize(Roles = AppRoles.AdminOrSalad)]
    public async Task<ActionResult<OrderResponseDto>> AdvanceSaladStatus(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.AdvanceSaladStatusAsync(id, User.GetUserId(), cancellationToken));

    [HttpPost("{id:int}/advance-kitchen-status")]
    [Authorize(Roles = AppRoles.AdminOrKitchen)]
    public async Task<ActionResult<OrderResponseDto>> AdvanceKitchenStatus(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.AdvanceKitchenStatusAsync(id, User.GetUserId(), cancellationToken));

    [HttpPost("{id:int}/mark-paid")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<OrderResponseDto>> MarkPaid(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.MarkPaidAsync(id, User.GetUserId(), cancellationToken));

    [HttpPost("{id:int}/cancel")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> Cancel(int id, CancellationToken cancellationToken) =>
        Ok(await ordersService.CancelAsync(id, User.GetUserId(), cancellationToken));

    [HttpPost("{id:int}/items")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> AddItem(int id, AddOrderItemDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.AddItemAsync(id, dto, cancellationToken));

    [HttpPut("{id:int}/items/{itemId:int}")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> UpdateItem(int id, int itemId, UpdateOrderItemDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.UpdateItemAsync(id, itemId, dto, cancellationToken));

    [HttpPut("{id:int}/items/{itemId:int}/status")]
    [Authorize(Roles = AppRoles.AdminOrKitchen)]
    public async Task<ActionResult<OrderResponseDto>> UpdateItemStatus(int id, int itemId, UpdateOrderItemStatusDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.UpdateItemStatusAsync(id, itemId, User.GetUserId(), dto, cancellationToken));

    [HttpDelete("{id:int}/items/{itemId:int}")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> DeleteItem(int id, int itemId, CancellationToken cancellationToken) =>
        Ok(await ordersService.DeleteItemAsync(id, itemId, cancellationToken));

    [HttpPut("{id:int}/tables")]
    [Authorize(Roles = AppRoles.AdminOrWaiter)]
    public async Task<ActionResult<OrderResponseDto>> UpdateTables(int id, UpdateOrderTablesDto dto, CancellationToken cancellationToken) =>
        Ok(await ordersService.UpdateTablesAsync(id, dto, cancellationToken));

    private bool IsWaiterOnly() =>
        User.IsInRole(AppRoles.Waiter) && !User.IsInRole(AppRoles.Admin);
}
