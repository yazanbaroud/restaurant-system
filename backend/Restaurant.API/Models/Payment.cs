using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class Payment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
}
