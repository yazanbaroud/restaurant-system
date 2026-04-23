namespace Restaurant.API.Models;

public sealed class OrderTable
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int TableId { get; set; }
    public Table Table { get; set; } = null!;
}
