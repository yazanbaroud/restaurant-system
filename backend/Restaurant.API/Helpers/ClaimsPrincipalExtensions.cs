using System.Security.Claims;

namespace Restaurant.API.Helpers;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(id, out var value) ? value : 0;
    }

    public static int? GetTokenVersion(this ClaimsPrincipal user)
    {
        var tokenVersion = user.FindFirstValue(AppClaimTypes.TokenVersion);
        return int.TryParse(tokenVersion, out var value) ? value : null;
    }
}
