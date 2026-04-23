using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class MenuController(IMenuService menuService) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyCollection<MenuItemResponseDto>>> GetAll([FromQuery] MenuCategory? category, [FromQuery] bool? isAvailable, CancellationToken cancellationToken)
    {
        var effectiveAvailability = CanReadUnavailableMenuItems() ? isAvailable : true;
        return Ok(await menuService.GetAllAsync(category, effectiveAvailability, cancellationToken));
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<MenuItemResponseDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await menuService.GetByIdAsync(id, CanReadUnavailableMenuItems(), cancellationToken));

    [HttpPost]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<MenuItemResponseDto>> Create(CreateMenuItemDto dto, CancellationToken cancellationToken)
    {
        var item = await menuService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<MenuItemResponseDto>> Update(int id, UpdateMenuItemDto dto, CancellationToken cancellationToken) =>
        Ok(await menuService.UpdateAsync(id, dto, cancellationToken));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await menuService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:int}/images")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<MenuItemImageResponseDto>> AddImage(int id, AddMenuItemImageDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await menuService.AddImageAsync(id, dto, cancellationToken));

    [HttpDelete("{id:int}/images/{imageId:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> DeleteImage(int id, int imageId, CancellationToken cancellationToken)
    {
        await menuService.DeleteImageAsync(id, imageId, cancellationToken);
        return NoContent();
    }

    private bool CanReadUnavailableMenuItems() =>
        User.Identity?.IsAuthenticated == true && User.IsInRole(AppRoles.Admin);
}
