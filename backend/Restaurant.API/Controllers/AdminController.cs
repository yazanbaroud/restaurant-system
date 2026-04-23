using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class AdminController(IAdminService adminService) : ControllerBase
{
    [HttpPost("create-waiter")]
    public async Task<ActionResult<UserResponseDto>> CreateWaiter(CreateWaiterDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await adminService.CreateWaiterAsync(dto, cancellationToken));

    [HttpPost("create-admin")]
    public async Task<ActionResult<UserResponseDto>> CreateAdmin(CreateAdminDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await adminService.CreateAdminAsync(dto, cancellationToken));
}
