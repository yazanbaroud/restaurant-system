using System.Security.Cryptography;

namespace Restaurant.API.Helpers;

public static class RefreshTokenSecurity
{
    private const int TokenBytes = 64;

    public static string CreateToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(TokenBytes));

    public static string HashToken(string token)
    {
        var tokenBytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(tokenBytes);
        return Convert.ToHexString(hash);
    }
}
