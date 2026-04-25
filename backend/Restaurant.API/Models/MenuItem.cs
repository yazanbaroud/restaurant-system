using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class MenuItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Category { get; set; }
    public bool IsAvailable { get; set; } = true;
    public ICollection<MenuItemImage> Images { get; set; } = new List<MenuItemImage>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
