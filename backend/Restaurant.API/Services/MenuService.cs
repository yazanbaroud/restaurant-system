using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class MenuService(AppDbContext db, ILogger<MenuService> logger) : IMenuService
{
    public async Task<IReadOnlyCollection<MenuItemResponseDto>> GetAllAsync(int? category, bool? isAvailable, bool includeInactiveCategories, CancellationToken cancellationToken)
    {
        var query = db.MenuItems.AsNoTracking().Include(x => x.Images).AsQueryable();
        if (category.HasValue) query = query.Where(x => x.Category == category.Value);
        if (isAvailable.HasValue) query = query.Where(x => x.IsAvailable == isAvailable.Value);
        if (!includeInactiveCategories)
        {
            var activeCategoryIds = await db.MenuCategories.AsNoTracking()
                .Where(x => x.IsActive)
                .Select(x => x.Id)
                .ToArrayAsync(cancellationToken);
            query = query.Where(x => activeCategoryIds.Contains(x.Category));
        }

        var items = await query.OrderBy(x => x.Category).ThenBy(x => x.Name).ToArrayAsync(cancellationToken);
        var categoryNames = await GetCategoryNamesAsync(cancellationToken);
        return items.Select(x => x.ToMenuItemResponse(CategoryName(categoryNames, x.Category))).ToArray();
    }

    public async Task<MenuItemResponseDto> GetByIdAsync(int id, bool includeUnavailable, CancellationToken cancellationToken)
    {
        var query = db.MenuItems.AsNoTracking().Include(x => x.Images).AsQueryable();
        if (!includeUnavailable)
        {
            query = query.Where(x => x.IsAvailable);
        }

        if (!includeUnavailable)
        {
            var activeCategoryIds = await db.MenuCategories.AsNoTracking()
                .Where(x => x.IsActive)
                .Select(x => x.Id)
                .ToArrayAsync(cancellationToken);
            query = query.Where(x => activeCategoryIds.Contains(x.Category));
        }

        var item = await query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu item not found.", StatusCodes.Status404NotFound);
        var categoryNames = await GetCategoryNamesAsync(cancellationToken);
        return item.ToMenuItemResponse(CategoryName(categoryNames, item.Category));
    }

    public async Task<MenuItemResponseDto> CreateAsync(CreateMenuItemDto dto, CancellationToken cancellationToken)
    {
        var name = dto.Name.Trim();
        if (await db.MenuItems.AnyAsync(x => x.Name == name, cancellationToken))
        {
            throw new ApiException("A menu item with this name already exists.", StatusCodes.Status409Conflict);
        }

        var category = await GetCategoryAsync(dto.Category, cancellationToken);
        if (!category.IsActive)
        {
            throw new ApiException("Menu category is inactive.", StatusCodes.Status400BadRequest);
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
        return item.ToMenuItemResponse(category.Name);
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

        var category = await GetCategoryAsync(dto.Category, cancellationToken);

        item.Name = name;
        item.Description = dto.Description.Trim();
        item.Price = dto.Price;
        item.Category = dto.Category;
        item.IsAvailable = dto.IsAvailable;
        await db.SaveChangesAsync(cancellationToken);
        return item.ToMenuItemResponse(category.Name);
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

    public async Task<IReadOnlyCollection<MenuCategoryResponseDto>> GetCategoriesAsync(bool includeInactive, CancellationToken cancellationToken)
    {
        var query = db.MenuCategories.AsNoTracking().AsQueryable();
        if (!includeInactive)
        {
            query = query.Where(x => x.IsActive);
        }

        var categories = await query.OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToArrayAsync(cancellationToken);
        return categories.Select(x => x.ToMenuCategoryResponse()).ToArray();
    }

    public async Task<MenuCategoryResponseDto> CreateCategoryAsync(CreateMenuCategoryDto dto, CancellationToken cancellationToken)
    {
        var name = dto.Name.Trim();
        if (await db.MenuCategories.AnyAsync(x => x.Name == name, cancellationToken))
        {
            throw new ApiException("A menu category with this name already exists.", StatusCodes.Status409Conflict);
        }

        var sortOrder = await db.MenuCategories.MaxAsync(x => (int?)x.SortOrder, cancellationToken) ?? 0;
        var category = new MenuCategoryRecord
        {
            Name = name,
            IsActive = dto.IsActive,
            SortOrder = sortOrder + 10
        };

        db.MenuCategories.Add(category);
        await db.SaveChangesAsync(cancellationToken);
        return category.ToMenuCategoryResponse();
    }

    public async Task<MenuCategoryResponseDto> UpdateCategoryAsync(int id, UpdateMenuCategoryDto dto, CancellationToken cancellationToken)
    {
        var category = await db.MenuCategories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu category not found.", StatusCodes.Status404NotFound);

        var name = dto.Name.Trim();
        if (await db.MenuCategories.AnyAsync(x => x.Id != id && x.Name == name, cancellationToken))
        {
            throw new ApiException("A menu category with this name already exists.", StatusCodes.Status409Conflict);
        }

        category.Name = name;
        category.IsActive = dto.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return category.ToMenuCategoryResponse();
    }

    public async Task DeleteCategoryAsync(int id, CancellationToken cancellationToken)
    {
        var category = await db.MenuCategories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu category not found.", StatusCodes.Status404NotFound);

        if (await db.MenuItems.AnyAsync(x => x.Category == id, cancellationToken))
        {
            throw new ApiException("לא ניתן למחוק קטגוריה שיש בה מנות. ניתן להפוך אותה ללא פעילה.", StatusCodes.Status409Conflict);
        }

        db.MenuCategories.Remove(category);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Menu category {MenuCategoryId} deleted", category.Id);
    }

    private async Task<MenuCategoryRecord> GetCategoryAsync(int id, CancellationToken cancellationToken) =>
        await db.MenuCategories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Menu category not found.", StatusCodes.Status400BadRequest);

    private async Task<Dictionary<int, string>> GetCategoryNamesAsync(CancellationToken cancellationToken) =>
        await db.MenuCategories.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

    private static string CategoryName(IReadOnlyDictionary<int, string> categories, int category) =>
        categories.TryGetValue(category, out var name) ? name : string.Empty;
}
