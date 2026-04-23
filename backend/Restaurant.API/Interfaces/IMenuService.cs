using Restaurant.API.DTOs;
using Restaurant.API.Enums;

namespace Restaurant.API.Interfaces;

public interface IMenuService
{
    Task<IReadOnlyCollection<MenuItemResponseDto>> GetAllAsync(MenuCategory? category, bool? isAvailable, CancellationToken cancellationToken);
    Task<MenuItemResponseDto> GetByIdAsync(int id, bool includeUnavailable, CancellationToken cancellationToken);
    Task<MenuItemResponseDto> CreateAsync(CreateMenuItemDto dto, CancellationToken cancellationToken);
    Task<MenuItemResponseDto> UpdateAsync(int id, UpdateMenuItemDto dto, CancellationToken cancellationToken);
    Task DeleteAsync(int id, CancellationToken cancellationToken);
    Task<MenuItemImageResponseDto> AddImageAsync(int id, AddMenuItemImageDto dto, CancellationToken cancellationToken);
    Task DeleteImageAsync(int id, int imageId, CancellationToken cancellationToken);
}
