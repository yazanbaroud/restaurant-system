using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class Order
{
    public int Id { get; set; }
    public Guid UniqueIdentifier { get; set; } = Guid.NewGuid();
    public string OrderNumber { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public User? User { get; set; }
    public string CustomerFirstName { get; set; } = string.Empty;
    public string CustomerLastName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public OrderStatus Status { get; set; } = OrderStatus.Open;
    public KitchenStatus KitchenStatus { get; set; } = KitchenStatus.New;
    public string? Notes { get; set; }
    public decimal TotalAmount { get; set; }
    public OrderType OrderType { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;
    public DateTime? OrderStatusChangedAt { get; set; }
    public int? OrderStatusChangedByUserId { get; set; }
    public DateTime? KitchenStatusChangedAt { get; set; }
    public int? KitchenStatusChangedByUserId { get; set; }
    public DateTime? PaymentStatusChangedAt { get; set; }
    public int? PaymentStatusChangedByUserId { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<PaymentRefund> Refunds { get; set; } = new List<PaymentRefund>();
    public ICollection<OrderTable> OrderTables { get; set; } = new List<OrderTable>();
    public ICollection<OrderStatusChange> StatusChanges { get; set; } = new List<OrderStatusChange>();
}
