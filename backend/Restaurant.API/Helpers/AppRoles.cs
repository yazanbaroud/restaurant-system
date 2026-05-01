using Restaurant.API.Enums;

namespace Restaurant.API.Helpers;

public static class AppRoles
{
    public const string Admin = nameof(UserRole.Admin);
    public const string Waiter = nameof(UserRole.Waiter);
    public const string Customer = nameof(UserRole.Customer);
    public const string Kitchen = nameof(UserRole.Kitchen);
    public const string Salad = nameof(UserRole.Salad);
    public const string AdminOrWaiter = Admin + "," + Waiter;
    public const string AdminOrWaiterOrKitchenOrSalad = Admin + "," + Waiter + "," + Kitchen + "," + Salad;
    public const string AdminOrKitchen = Admin + "," + Kitchen;
    public const string AdminOrSalad = Admin + "," + Salad;
    public const string AdminOrManager = Admin;
}
