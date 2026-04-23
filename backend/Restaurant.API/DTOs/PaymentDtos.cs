using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreatePaymentDto(int OrderId, decimal Amount, PaymentMethod Method);
public sealed record PaymentResponseDto(int Id, int OrderId, decimal Amount, PaymentMethod Method, DateTime PaidAt);
