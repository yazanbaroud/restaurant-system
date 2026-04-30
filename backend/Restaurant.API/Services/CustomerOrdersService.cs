using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class CustomerOrdersService(
    AppDbContext db,
    IOrderTableAssignmentService tableAssignments,
    IOrderStateService orderState,
    IRestaurantRealtimeNotifier realtimeNotifier,
    ILogger<CustomerOrdersService> logger) : ICustomerOrdersService
{
    public async Task<IReadOnlyCollection<OrderResponseDto>> GetAllAsync(int userId, CancellationToken cancellationToken)
    {
        var orders = await IncludeOrderGraph(db.Orders.AsNoTracking())
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToArrayAsync(cancellationToken);

        return orders.Select(x => x.ToOrderResponse()).ToArray();
    }

    public async Task<OrderResponseDto> GetByIdAsync(int userId, int id, CancellationToken cancellationToken)
    {
        var order = await IncludeOrderGraph(db.Orders.AsNoTracking())
            .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> CreateAsync(int userId, CreateCustomerOrderDto dto, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(userId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var customer = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
                ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);
            var menuItems = await LoadAvailableMenuItemsAsync(dto.Items.Select(x => x.MenuItemId), cancellationToken);
            var now = DateTime.UtcNow;
            var order = new Order
            {
                UserId = userId,
                CustomerFirstName = customer.FirstName,
                CustomerLastName = customer.LastName,
                Notes = dto.Notes?.Trim(),
                CreatedAt = now,
                OrderNumber = OrderNumberGenerator.Create(now),
                OrderType = dto.OrderType
            };

            orderState.Initialize(order, userId, now);

            foreach (var item in dto.Items)
            {
                var menuItem = menuItems[item.MenuItemId];
                order.Items.Add(new OrderItem
                {
                    MenuItemId = menuItem.Id,
                    Quantity = item.Quantity,
                    UnitPrice = menuItem.Price,
                    Notes = item.Notes?.Trim()
                });
            }

            await tableAssignments.AssignTablesForNewOrderAsync(order, dto.OrderType, ToTableIds(dto.TableId), cancellationToken);
            RecalculateTotal(order);
            db.Orders.Add(order);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            var response = order.ToOrderResponse();
            logger.LogInformation("Customer {UserId} created order {OrderId}", userId, order.Id);
            await realtimeNotifier.OrderCreatedAsync(response, userId, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Customer {UserId} order creation concurrency conflict", userId);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Customer {UserId} order creation SQL concurrency conflict", userId);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<OrderResponseDto> UpdateAsync(int userId, int id, UpdateCustomerOrderDto dto, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(userId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadOwnedTrackedOrderForUpdateAsync(userId, id, cancellationToken);
            orderState.EnsureItemsCanBeChanged(order);
            await tableAssignments.ReplaceTablesAsync(order, dto.OrderType, ToTableIds(dto.TableId), cancellationToken);

            order.OrderType = dto.OrderType;
            order.Notes = dto.Notes?.Trim();
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            return await SendOrderUpdatedAsync(order, cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Customer {UserId} order {OrderId} update concurrency conflict", userId, id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Customer {UserId} order {OrderId} update SQL concurrency conflict", userId, id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public Task<OrderResponseDto> AddItemAsync(int userId, int id, CustomerOrderItemInputDto dto, CancellationToken cancellationToken) =>
        MutateOwnedOrderItemsAsync(
            userId,
            id,
            async (order, token) =>
            {
                var menuItem = await LoadAvailableMenuItemAsync(dto.MenuItemId, token);
                order.Items.Add(new OrderItem
                {
                    MenuItemId = menuItem.Id,
                    Quantity = dto.Quantity,
                    UnitPrice = menuItem.Price,
                    Notes = dto.Notes?.Trim()
                });
            },
            "item add",
            cancellationToken);

    public Task<OrderResponseDto> UpdateItemAsync(int userId, int id, int itemId, UpdateCustomerOrderItemDto dto, CancellationToken cancellationToken) =>
        MutateOwnedOrderItemsAsync(
            userId,
            id,
            (order, _) =>
            {
                var item = order.Items.SingleOrDefault(x => x.Id == itemId)
                    ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);

                item.Quantity = dto.Quantity;
                item.Notes = dto.Notes?.Trim();
                return Task.CompletedTask;
            },
            "item update",
            cancellationToken);

    public Task<OrderResponseDto> DeleteItemAsync(int userId, int id, int itemId, CancellationToken cancellationToken) =>
        MutateOwnedOrderItemsAsync(
            userId,
            id,
            (order, _) =>
            {
                var item = order.Items.SingleOrDefault(x => x.Id == itemId)
                    ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);

                if (order.Items.Count <= 1)
                {
                    throw new ApiException("Order must include at least one item.");
                }

                order.Items.Remove(item);
                return Task.CompletedTask;
            },
            "item delete",
            cancellationToken);

    public async Task<IReadOnlyCollection<CustomerTableOptionDto>> GetAvailableTablesAsync(CancellationToken cancellationToken) =>
        await tableAssignments.GetAvailableTableOptionsAsync(cancellationToken);

    private static IQueryable<Order> IncludeOrderGraph(IQueryable<Order> query) =>
        query.Include(x => x.Items).ThenInclude(x => x.MenuItem)
            .Include(x => x.OrderTables).ThenInclude(x => x.Table)
            .Include(x => x.StatusChanges);

    private async Task<Order> LoadOwnedTrackedOrderAsync(int userId, int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(db.Orders).Include(x => x.Payments)
            .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private async Task<Order> LoadOwnedTrackedOrderForUpdateAsync(int userId, int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(db.Orders
                .FromSqlInterpolated($"SELECT * FROM [Orders] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id} AND [UserId] = {userId}"))
            .Include(x => x.Payments)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private async Task<OrderResponseDto> MutateOwnedOrderItemsAsync(
        int userId,
        int id,
        Func<Order, CancellationToken, Task> mutate,
        string operation,
        CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(userId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadOwnedTrackedOrderForUpdateAsync(userId, id, cancellationToken);
            orderState.EnsureItemsCanBeChanged(order);
            await mutate(order, cancellationToken);
            RecalculateTotal(order);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            return await SendOrderUpdatedAsync(order, cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Customer {UserId} order {OrderId} {Operation} concurrency conflict", userId, id, operation);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Customer {UserId} order {OrderId} {Operation} SQL concurrency conflict", userId, id, operation);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task ReloadOrderAsync(Order order, CancellationToken cancellationToken)
    {
        await db.Entry(order).Collection(x => x.Items).Query().Include(x => x.MenuItem).LoadAsync(cancellationToken);
        await db.Entry(order).Collection(x => x.OrderTables).Query().Include(x => x.Table).LoadAsync(cancellationToken);
        await db.Entry(order).Collection(x => x.StatusChanges).LoadAsync(cancellationToken);
    }

    private async Task<Dictionary<int, MenuItem>> LoadAvailableMenuItemsAsync(IEnumerable<int> ids, CancellationToken cancellationToken)
    {
        var distinctIds = ids.Distinct().ToArray();
        var items = await db.MenuItems
            .Where(x => distinctIds.Contains(x.Id) && x.IsAvailable)
            .ToArrayAsync(cancellationToken);
        var activeCategoryIds = await db.MenuCategories.AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => x.Id)
            .ToArrayAsync(cancellationToken);
        var activeCategorySet = activeCategoryIds.ToHashSet();
        var availableItems = items.Where(x => activeCategorySet.Contains(x.Category)).ToDictionary(x => x.Id);

        if (availableItems.Count != distinctIds.Length)
        {
            throw new ApiException("One or more menu items were not found or are unavailable.");
        }

        return availableItems;
    }

    private async Task<MenuItem> LoadAvailableMenuItemAsync(int id, CancellationToken cancellationToken) =>
        (await LoadAvailableMenuItemsAsync([id], cancellationToken))[id];

    private static IReadOnlyCollection<int> ToTableIds(int? tableId) =>
        tableId is > 0 ? [tableId.Value] : Array.Empty<int>();

    private static void RecalculateTotal(Order order) =>
        order.TotalAmount = order.Items.Sum(x => x.UnitPrice * x.Quantity);

    private async Task<OrderResponseDto> SendOrderUpdatedAsync(Order order, CancellationToken cancellationToken)
    {
        var response = order.ToOrderResponse();
        await realtimeNotifier.OrderUpdatedAsync(response, order.UserId, cancellationToken);
        return response;
    }

    private static void EnsureAuthenticatedUser(int userId)
    {
        if (userId <= 0)
        {
            throw new ApiException("Authenticated user was not found.", StatusCodes.Status401Unauthorized);
        }
    }

    private async Task RollbackQuietlyAsync(Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction, CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Failed to roll back customer order transaction");
        }
    }

    private static bool IsSqlConcurrencyFailure(DbUpdateException exception) =>
        exception.InnerException is SqlException sqlException &&
        sqlException.Errors.Cast<SqlError>().Any(error => error.Number == 1205);
}
