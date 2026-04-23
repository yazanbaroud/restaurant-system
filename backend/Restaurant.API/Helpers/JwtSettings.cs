namespace Restaurant.API.Helpers;

public sealed class JwtSettings
{
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string Secret { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; } = 120;
}
