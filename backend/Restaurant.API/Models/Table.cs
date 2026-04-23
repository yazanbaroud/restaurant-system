using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class Table
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public TableStatus Status { get; set; } = TableStatus.Available;
    public ICollection<OrderTable> OrderTables { get; set; } = new List<OrderTable>();
}
