using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class MenuService(AppDbContext db, ILogger<MenuService> logger) : IMenuService
{
    public async Task<IReadOnlyCollection<MenuItemResponseDto>> GetAllAsync(MenuCategory? category, bool? isAvailable, CancellationToken cancellationToken)
    {
        var query = db.MenuItems.AsNoTracking().Include(x => x.Images).AsQueryable();
        if (category.HasValue) query = query.Where(x => x.Category == category.Value);
        if (isAvailable.HasValue) query = query.Where(x => x.IsAvailable == isAvailable.Value);
        var items = await query.OrderBy(x => x.Category).ThenBy(x => x.Name).ToArrayAsync(cancellationToken);
        return items.Select(x => x.ToMenuItemResponse()).ToArray();
    }

    public async Task<MenuItemResponseDto> GetByIdAsync(int id, bool includeUnavailable, CancellationToken cancellationToken)
    {
        var query = db.MenuItems.AsNoTracking().Include(x => x.Images).AsQueryable();
        if (!includeUnavailable)
        {
            query = query.Where(x => x.IsAvailable);
        }

        var item = await query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu item not found.", StatusCodes.Status404NotFound);
        return item.ToMenuItemResponse();
    }

    public async Task<MenuItemResponseDto> CreateAsync(CreateMenuItemDto dto, CancellationToken cancellationToken)
    {
        var name = dto.Name.Trim();
        if (await db.MenuItems.AnyAsync(x => x.Name == name, cancellationToken))
        {
            throw new ApiException("A menu item with this name already exists.", StatusCodes.Status409Conflict);
        }

        var item = new MenuItem
        {
            Name = name,
            Description = dto.Description.Trim(),
            Price = dto.Price,
            Category = dto.Category,
            IsAvailable = dto.IsAvailable
        };

        db.MenuItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);
        return item.ToMenuItemResponse();
    }

    public async Task<MenuItemResponseDto> UpdateAsync(int id, UpdateMenuItemDto dto, CancellationToken cancellationToken)
    {
        var item = await db.MenuItems.Include(x => x.Images).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu item not found.", StatusCodes.Status404NotFound);

        var name = dto.Name.Trim();
        if (await db.MenuItems.AnyAsync(x => x.Id != id && x.Name == name, cancellationToken))
        {
            throw new ApiException("A menu item with this name already exists.", StatusCodes.Status409Conflict);
        }

        item.Name = name;
        item.Description = dto.Description.Trim();
        item.Price = dto.Price;
        item.Category = dto.Category;
        item.IsAvailable = dto.IsAvailable;
        await db.SaveChangesAsync(cancellationToken);
        return item.ToMenuItemResponse();
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var item = await db.MenuItems.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu item not found.", StatusCodes.Status404NotFound);
        item.IsAvailable = false;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Menu item {MenuItemId} marked unavailable", item.Id);
    }

    public async Task<MenuItemImageResponseDto> AddImageAsync(int id, AddMenuItemImageDto dto, CancellationToken cancellationToken)
    {
        var item = await db.MenuItems.Include(x => x.Images).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu item not found.", StatusCodes.Status404NotFound);

        if (dto.IsMainImage)
        {
            foreach (var existing in item.Images) existing.IsMainImage = false;
        }

        var image = new MenuItemImage { MenuItemId = id, ImageUrl = dto.ImageUrl.Trim(), IsMainImage = dto.IsMainImage };
        item.Images.Add(image);
        await db.SaveChangesAsync(cancellationToken);
        return new MenuItemImageResponseDto(image.Id, image.MenuItemId, image.ImageUrl, image.IsMainImage);
    }

    public async Task DeleteImageAsync(int id, int imageId, CancellationToken cancellationToken)
    {
        var image = await db.MenuItemImages.SingleOrDefaultAsync(x => x.Id == imageId && x.MenuItemId == id, cancellationToken)
            ?? throw new ApiException("Menu item image not found.", StatusCodes.Status404NotFound);
        db.MenuItemImages.Remove(image);
        await db.SaveChangesAsync(cancellationToken);
    }
}
