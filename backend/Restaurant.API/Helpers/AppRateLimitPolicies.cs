namespace Restaurant.API.Helpers;

public static class AppRateLimitPolicies
{
    public const string Login = "login";
    public const string Register = "register";
    public const string PublicReservation = "public-reservation";
    public const string CustomerOrderCreation = "customer-order-creation";
}
