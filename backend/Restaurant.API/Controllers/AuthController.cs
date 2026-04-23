using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto dto, CancellationToken cancellationToken) =>
        Ok(await authService.RegisterCustomerAsync(dto, cancellationToken));

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto, CancellationToken cancellationToken) =>
        Ok(await authService.LoginAsync(dto, cancellationToken));

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken cancellationToken) =>
        Ok(await authService.GetCurrentUserAsync(User.GetUserId(), cancellationToken));
}
