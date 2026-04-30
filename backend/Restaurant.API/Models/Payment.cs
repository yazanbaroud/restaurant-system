using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class Payment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid IdempotencyKey { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
    public byte[] RowVersion { get; set; } = [];
}
