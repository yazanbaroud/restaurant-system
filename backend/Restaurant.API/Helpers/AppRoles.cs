using Restaurant.API.Enums;

namespace Restaurant.API.Helpers;

public static class AppRoles
{
    public const string Admin = nameof(UserRole.Admin);
    public const string Waiter = nameof(UserRole.Waiter);
    public const string Kitchen = nameof(UserRole.Kitchen);
    public const string Salad = nameof(UserRole.Salad);
    public const string AdminOrWaiter = Admin + "," + Waiter;
    public const string AdminOrWaiterOrKitchen = Admin + "," + Waiter + "," + Kitchen;
    public const string AdminOrWaiterOrSalad = Admin + "," + Waiter + "," + Salad;
    public const string AdminOrWaiterOrKitchenOrSalad = Admin + "," + Waiter + "," + Kitchen + "," + Salad;
    public const string AdminOrKitchen = Admin + "," + Kitchen;
    public const string AdminOrSalad = Admin + "," + Salad;
    public const string AdminOrManager = Admin;
}
