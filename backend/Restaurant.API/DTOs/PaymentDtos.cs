using System.Text.Json.Serialization;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;

namespace Restaurant.API.DTOs;

public sealed record CreatePaymentDto(
    int OrderId,
    Guid IdempotencyKey,
    decimal Amount,
    [property: JsonConverter(typeof(PaymentMethodJsonConverter))]
    PaymentMethod Method,
    string? Note = null);

public sealed record CreatePaymentRefundDto(
    int OrderId,
    Guid IdempotencyKey,
    decimal Amount,
    string Reason,
    [property: JsonConverter(typeof(PaymentMethodJsonConverter))]
    PaymentMethod Method = PaymentMethod.Other);

public sealed record PaymentResponseDto(
    int Id,
    int OrderId,
    Guid IdempotencyKey,
    decimal Amount,
    [property: JsonConverter(typeof(PaymentMethodJsonConverter))]
    PaymentMethod Method,
    DateTime PaidAt,
    int RecordedByUserId,
    string? Note,
    DateTime CreatedAt,
    int CreatedByUserId);

public sealed record PaymentRefundResponseDto(
    int Id,
    int OrderId,
    Guid IdempotencyKey,
    decimal Amount,
    [property: JsonConverter(typeof(PaymentMethodJsonConverter))]
    PaymentMethod Method,
    string Reason,
    DateTime RefundedAt,
    int PerformedByUserId);

public sealed record CreatePaymentResponseDto(
    PaymentResponseDto Payment,
    int OrderId,
    OrderStatus OrderStatus,
    KitchenStatus KitchenStatus,
    PaymentStatus PaymentStatus,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal RemainingAmount);

public sealed record CreatePaymentRefundResponseDto(
    PaymentRefundResponseDto Refund,
    int OrderId,
    OrderStatus OrderStatus,
    KitchenStatus KitchenStatus,
    PaymentStatus PaymentStatus,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal RefundedAmount,
    decimal RemainingAmount);
