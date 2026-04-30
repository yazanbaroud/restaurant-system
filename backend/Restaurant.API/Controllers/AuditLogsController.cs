using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class AuditLogsController(IAuditService auditService) : ControllerBase
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 50;
    private const int MaxPageSize = 100;

    [HttpGet]
    public async Task<ActionResult<PagedAuditLogsResponseDto>> GetAll(
        [FromQuery] string? entityType,
        [FromQuery] int? userId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken,
        [FromQuery] int page = DefaultPage,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            throw new ApiException("Start date must be before or equal to end date.");
        }

        if (page < 1)
        {
            throw new ApiException("Page must be greater than zero.");
        }

        if (pageSize is < 1 or > MaxPageSize)
        {
            throw new ApiException($"Page size must be between 1 and {MaxPageSize}.");
        }

        return Ok(await auditService.GetAsync(entityType, userId, from, to, page, pageSize, cancellationToken));
    }
}
