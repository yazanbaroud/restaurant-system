using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreateMenuItemDto(string Name, string Description, decimal Price, MenuCategory Category, bool IsAvailable);
public sealed record UpdateMenuItemDto(string Name, string Description, decimal Price, MenuCategory Category, bool IsAvailable);
public sealed record AddMenuItemImageDto(string ImageUrl, bool IsMainImage);
public sealed record MenuItemImageResponseDto(int Id, int MenuItemId, string ImageUrl, bool IsMainImage);
public sealed record MenuItemResponseDto(
    int Id,
    string Name,
    string Description,
    decimal Price,
    MenuCategory Category,
    bool IsAvailable,
    IReadOnlyCollection<MenuItemImageResponseDto> Images);
