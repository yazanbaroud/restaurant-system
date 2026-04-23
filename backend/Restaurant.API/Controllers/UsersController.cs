using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class UsersController(IUsersService usersService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<UserResponseDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await usersService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserResponseDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await usersService.GetByIdAsync(id, cancellationToken));
}
