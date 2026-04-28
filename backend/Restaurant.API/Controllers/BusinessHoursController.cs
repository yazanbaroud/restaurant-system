using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/business-hours")]
public sealed class BusinessHoursController(IBusinessHoursService businessHoursService) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyCollection<BusinessHourResponseDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await businessHoursService.GetAllAsync(cancellationToken));
}
