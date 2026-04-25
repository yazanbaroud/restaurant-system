namespace Restaurant.API.DTOs;

public sealed record MenuCategoryResponseDto(int Id, string Name, bool IsActive, int SortOrder);
public sealed record CreateMenuCategoryDto(string Name, bool IsActive);
public sealed record UpdateMenuCategoryDto(string Name, bool IsActive);
public sealed record CreateMenuItemDto(string Name, string Description, decimal Price, int Category, bool IsAvailable);
public sealed record UpdateMenuItemDto(string Name, string Description, decimal Price, int Category, bool IsAvailable);
public sealed record AddMenuItemImageDto(string ImageUrl, bool IsMainImage);
public sealed record MenuItemImageResponseDto(int Id, int MenuItemId, string ImageUrl, bool IsMainImage);
public sealed record MenuItemResponseDto(
    int Id,
    string Name,
    string Description,
    decimal Price,
    int Category,
    string CategoryName,
    bool IsAvailable,
    IReadOnlyCollection<MenuItemImageResponseDto> Images);
