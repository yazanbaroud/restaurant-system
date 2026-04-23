using System.Security.Claims;

namespace Restaurant.API.Helpers;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(id, out var value) ? value : 0;
    }
}
