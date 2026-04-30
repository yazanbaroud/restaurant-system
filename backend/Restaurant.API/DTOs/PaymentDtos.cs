using System.Text.Json.Serialization;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;

namespace Restaurant.API.DTOs;

public sealed record CreatePaymentDto(
    int OrderId,
    Guid IdempotencyKey,
    decimal Amount,
    [property: JsonConverter(typeof(PaymentMethodJsonConverter))]
    PaymentMethod Method);

public sealed record PaymentResponseDto(
    int Id,
    int OrderId,
    Guid IdempotencyKey,
    decimal Amount,
    [property: JsonConverter(typeof(PaymentMethodJsonConverter))]
    PaymentMethod Method,
    DateTime CreatedAt,
    int CreatedByUserId);

public sealed record CreatePaymentResponseDto(
    PaymentResponseDto Payment,
    int OrderId,
    OrderStatus OrderStatus,
    KitchenStatus KitchenStatus,
    PaymentStatus PaymentStatus,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal RemainingAmount);
