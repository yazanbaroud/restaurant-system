namespace Restaurant.API.Models;

public sealed class MenuItemImage
{
    public int Id { get; set; }
    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;
    public string ImageUrl { get; set; } = string.Empty;
    public bool IsMainImage { get; set; }
}
