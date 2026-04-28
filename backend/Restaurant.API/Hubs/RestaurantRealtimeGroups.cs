namespace Restaurant.API.Hubs;

public static class RestaurantRealtimeGroups
{
    public const string Admin = "role:Admin";
    public const string Waiter = "role:Waiter";
    public const string Customer = "role:Customer";

    public static readonly IReadOnlyList<string> Operational = [Admin, Waiter];

    public static string User(int userId) => $"user:{userId}";
}
