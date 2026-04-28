using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Authorize(Roles = AppRoles.Admin)]
[Route("api/admin/business-hours")]
public sealed class AdminBusinessHoursController(IBusinessHoursService businessHoursService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<BusinessHourResponseDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await businessHoursService.GetAllAsync(cancellationToken));

    [HttpPut]
    public async Task<ActionResult<IReadOnlyCollection<BusinessHourResponseDto>>> Update(UpdateBusinessHoursDto dto, CancellationToken cancellationToken) =>
        Ok(await businessHoursService.UpdateAllAsync(dto, cancellationToken));
}
