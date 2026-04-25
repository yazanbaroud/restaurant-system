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

    [HttpPost]
    public async Task<ActionResult<UserResponseDto>> Create(CreateUserDto dto, CancellationToken cancellationToken)
    {
        var user = await usersService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, user);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserResponseDto>> Update(int id, UpdateUserDto dto, CancellationToken cancellationToken) =>
        Ok(await usersService.UpdateAsync(id, dto, cancellationToken));

    [HttpPut("{id:int}/role")]
    public async Task<ActionResult<UserResponseDto>> UpdateRole(int id, UpdateUserRoleDto dto, CancellationToken cancellationToken) =>
        Ok(await usersService.UpdateRoleAsync(User.GetUserId(), id, dto, cancellationToken));

    [HttpPut("{id:int}/password-reset")]
    public async Task<IActionResult> ResetPassword(int id, ResetUserPasswordDto dto, CancellationToken cancellationToken)
    {
        await usersService.ResetPasswordAsync(id, dto, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await usersService.DeleteAsync(id, User.GetUserId(), cancellationToken);
        return NoContent();
    }
}
