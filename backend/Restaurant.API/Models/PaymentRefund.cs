using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class PaymentRefund
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid IdempotencyKey { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; } = PaymentMethod.Other;
    public string Reason { get; set; } = string.Empty;
    public DateTime RefundedAt { get; set; } = DateTime.UtcNow;
    public int PerformedByUserId { get; set; }
    public User PerformedByUser { get; set; } = null!;
    public byte[] RowVersion { get; set; } = [];
}
