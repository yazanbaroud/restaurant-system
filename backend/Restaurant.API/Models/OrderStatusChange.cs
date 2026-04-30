using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class OrderStatusChange
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public OrderStatusChangeType ChangeType { get; set; }
    public string? FromValue { get; set; }
    public string ToValue { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public int ChangedByUserId { get; set; }
    public User ChangedByUser { get; set; } = null!;
}
