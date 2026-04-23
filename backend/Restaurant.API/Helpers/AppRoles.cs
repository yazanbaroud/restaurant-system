using Restaurant.API.Enums;

namespace Restaurant.API.Helpers;

public static class AppRoles
{
    public const string Admin = nameof(UserRole.Admin);
    public const string Waiter = nameof(UserRole.Waiter);
    public const string Customer = nameof(UserRole.Customer);
    public const string AdminOrWaiter = Admin + "," + Waiter;
}
