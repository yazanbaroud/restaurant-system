using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.AdminOrWaiter)]
public sealed class TablesController(ITablesService tablesService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<TableResponseDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await tablesService.GetAllAsync(cancellationToken));

    [HttpPost]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<TableResponseDto>> Create(CreateTableDto dto, CancellationToken cancellationToken) =>
        Created(string.Empty, await tablesService.CreateAsync(dto, cancellationToken));

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<TableResponseDto>> Update(int id, UpdateTableDto dto, CancellationToken cancellationToken) =>
        Ok(await tablesService.UpdateAsync(id, dto, cancellationToken));

    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<TableResponseDto>> UpdateStatus(int id, UpdateTableStatusDto dto, CancellationToken cancellationToken) =>
        Ok(await tablesService.UpdateStatusAsync(id, dto, cancellationToken));
}
