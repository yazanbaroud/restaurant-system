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
    public OrderStatus Status { get; set; } = OrderStatus.InSalads;
    public string? Notes { get; set; }
    public decimal TotalPrice { get; set; }
    public OrderType OrderType { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<OrderTable> OrderTables { get; set; } = new List<OrderTable>();
}
