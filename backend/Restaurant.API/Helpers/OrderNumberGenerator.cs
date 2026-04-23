namespace Restaurant.API.Helpers;

public static class OrderNumberGenerator
{
    public static string Create(DateTime utcNow) => $"ORD-{utcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}";
}
