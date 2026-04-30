using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    [EnableRateLimiting(AppRateLimitPolicies.Register)]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto dto, CancellationToken cancellationToken) =>
        Ok(await authService.RegisterCustomerAsync(dto, cancellationToken));

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(AppRateLimitPolicies.Login)]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto, CancellationToken cancellationToken) =>
        Ok(await authService.LoginAsync(dto, cancellationToken));

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Refresh(RefreshTokenDto dto, CancellationToken cancellationToken) =>
        Ok(await authService.RefreshAsync(dto, cancellationToken));

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(LogoutDto dto, CancellationToken cancellationToken)
    {
        int? userId = User.Identity?.IsAuthenticated == true ? User.GetUserId() : null;
        await authService.LogoutAsync(userId, dto, cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken cancellationToken) =>
        Ok(await authService.GetCurrentUserAsync(User.GetUserId(), cancellationToken));

    [HttpPut("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserDto>> UpdateMe(UpdateCurrentUserDto dto, CancellationToken cancellationToken) =>
        Ok(await authService.UpdateCurrentUserAsync(User.GetUserId(), dto, cancellationToken));

    [HttpPut("me/password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto dto, CancellationToken cancellationToken)
    {
        await authService.ChangePasswordAsync(User.GetUserId(), dto, cancellationToken);
        return NoContent();
    }
}
