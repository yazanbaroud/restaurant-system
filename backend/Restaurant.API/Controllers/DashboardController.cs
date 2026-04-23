using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class DashboardController(IDashboardService dashboardService) : ControllerBase
{
    [HttpGet("admin")]
    public async Task<ActionResult<AdminDashboardDto>> Admin(CancellationToken cancellationToken) =>
        Ok(await dashboardService.GetAdminDashboardAsync(cancellationToken));
}
