using System.Text.Json;
using System.Text.Json.Serialization;
using Restaurant.API.Enums;

namespace Restaurant.API.Helpers;

public sealed class PaymentMethodJsonConverter : JsonConverter<PaymentMethod>
{
    public override PaymentMethod Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var numericValue))
        {
            return numericValue switch
            {
                (int)PaymentMethod.Cash => PaymentMethod.Cash,
                (int)PaymentMethod.Card => PaymentMethod.Card,
                _ => throw new JsonException("Payment method must be Cash or Card.")
            };
        }

        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("Payment method must be Cash or Card.");
        }

        var value = reader.GetString()?.Trim();
        return value?.ToLowerInvariant().Replace("_", string.Empty).Replace("-", string.Empty) switch
        {
            "cash" => PaymentMethod.Cash,
            "card" or "creditcard" => PaymentMethod.Card,
            _ => throw new JsonException("Payment method must be Cash or Card.")
        };
    }

    public override void Write(Utf8JsonWriter writer, PaymentMethod value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString());
}
