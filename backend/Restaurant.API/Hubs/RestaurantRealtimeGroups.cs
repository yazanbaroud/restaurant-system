namespace Restaurant.API.Hubs;

public static class RestaurantRealtimeGroups
{
    public const string Admin = "role:Admin";
    public const string Waiter = "role:Waiter";
    public const string Kitchen = "role:Kitchen";
    public const string Salad = "role:Salad";

    public static readonly IReadOnlyList<string> Operational = [Admin, Waiter];
    public static readonly IReadOnlyList<string> OrderObservers = [Admin, Waiter, Kitchen, Salad];
}
