using Restaurant.API.DTOs;
namespace Restaurant.API.Interfaces;

public interface IMenuService
{
    Task<IReadOnlyCollection<MenuItemResponseDto>> GetAllAsync(int? category, bool? isAvailable, bool includeInactiveCategories, CancellationToken cancellationToken);
    Task<MenuItemResponseDto> GetByIdAsync(int id, bool includeUnavailable, CancellationToken cancellationToken);
    Task<MenuItemResponseDto> CreateAsync(CreateMenuItemDto dto, CancellationToken cancellationToken);
    Task<MenuItemResponseDto> UpdateAsync(int id, UpdateMenuItemDto dto, CancellationToken cancellationToken);
    Task DeleteAsync(int id, CancellationToken cancellationToken);
    Task<MenuItemImageResponseDto> AddImageAsync(int id, AddMenuItemImageDto dto, CancellationToken cancellationToken);
    Task DeleteImageAsync(int id, int imageId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<MenuCategoryResponseDto>> GetCategoriesAsync(bool includeInactive, CancellationToken cancellationToken);
    Task<MenuCategoryResponseDto> CreateCategoryAsync(CreateMenuCategoryDto dto, CancellationToken cancellationToken);
    Task<MenuCategoryResponseDto> UpdateCategoryAsync(int id, UpdateMenuCategoryDto dto, CancellationToken cancellationToken);
}
