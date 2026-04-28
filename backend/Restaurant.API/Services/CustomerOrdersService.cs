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
        var customer = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);
        var assignedTables = await ValidateAndLoadCustomerTablesAsync(dto.OrderType, dto.TableId, Array.Empty<int>(), cancellationToken);
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
            OrderType = dto.OrderType,
            Status = OrderStatus.InSalads,
            PaymentStatus = PaymentStatus.Unpaid
        };

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

        AddOrderTables(order, assignedTables.Select(x => x.Id));
        MarkTablesOccupied(assignedTables);
        RecalculateTotal(order);
        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        await ReloadOrderAsync(order, cancellationToken);

        var response = order.ToOrderResponse();
        logger.LogInformation("Customer {UserId} created order {OrderId}", userId, order.Id);
        await realtimeNotifier.OrderCreatedAsync(response, userId, cancellationToken);
        return response;
    }

    public async Task<OrderResponseDto> UpdateAsync(int userId, int id, UpdateCustomerOrderDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadOwnedTrackedOrderAsync(userId, id, cancellationToken);
        EnsureEditable(order);
        var assignedTables = await ValidateAndLoadCustomerTablesAsync(
            dto.OrderType,
            dto.TableId,
            order.OrderTables.Select(x => x.TableId).ToArray(),
            cancellationToken);

        if (dto.OrderType == OrderType.TakeAway)
        {
            ReleaseAssignedTables(order);
            order.OrderTables.Clear();
        }
        else
        {
            var newTableIds = assignedTables.Select(x => x.Id).ToHashSet();
            foreach (var removedTable in order.OrderTables.Where(x => !newTableIds.Contains(x.TableId)).Select(x => x.Table))
            {
                if (removedTable.Status == TableStatus.Occupied)
                {
                    removedTable.Status = TableStatus.Available;
                }
            }

            order.OrderTables.Clear();
            AddOrderTables(order, newTableIds);
            MarkTablesOccupied(assignedTables);
        }

        order.OrderType = dto.OrderType;
        order.Notes = dto.Notes?.Trim();
        await db.SaveChangesAsync(cancellationToken);
        await ReloadOrderAsync(order, cancellationToken);

        return await SendOrderUpdatedAsync(order, cancellationToken);
    }

    public async Task<OrderResponseDto> AddItemAsync(int userId, int id, CustomerOrderItemInputDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadOwnedTrackedOrderAsync(userId, id, cancellationToken);
        EnsureEditable(order);
        var menuItem = await LoadAvailableMenuItemAsync(dto.MenuItemId, cancellationToken);

        order.Items.Add(new OrderItem
        {
            MenuItemId = menuItem.Id,
            Quantity = dto.Quantity,
            UnitPrice = menuItem.Price,
            Notes = dto.Notes?.Trim()
        });
        RecalculateTotal(order);
        await UpdatePaymentStatusAsync(order, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ReloadOrderAsync(order, cancellationToken);

        return await SendOrderUpdatedAsync(order, cancellationToken);
    }

    public async Task<OrderResponseDto> UpdateItemAsync(int userId, int id, int itemId, UpdateCustomerOrderItemDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadOwnedTrackedOrderAsync(userId, id, cancellationToken);
        EnsureEditable(order);
        var item = order.Items.SingleOrDefault(x => x.Id == itemId)
            ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);

        item.Quantity = dto.Quantity;
        item.Notes = dto.Notes?.Trim();
        RecalculateTotal(order);
        await UpdatePaymentStatusAsync(order, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return await SendOrderUpdatedAsync(order, cancellationToken);
    }

    public async Task<OrderResponseDto> DeleteItemAsync(int userId, int id, int itemId, CancellationToken cancellationToken)
    {
        var order = await LoadOwnedTrackedOrderAsync(userId, id, cancellationToken);
        EnsureEditable(order);
        var item = order.Items.SingleOrDefault(x => x.Id == itemId)
            ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);

        if (order.Items.Count <= 1)
        {
            throw new ApiException("An order must contain at least one item.");
        }

        order.Items.Remove(item);
        RecalculateTotal(order);
        await UpdatePaymentStatusAsync(order, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return await SendOrderUpdatedAsync(order, cancellationToken);
    }

    public async Task<IReadOnlyCollection<CustomerTableOptionDto>> GetAvailableTablesAsync(CancellationToken cancellationToken) =>
        await db.Tables.AsNoTracking()
            .Where(x => x.Status == TableStatus.Available)
            .OrderBy(x => x.Name)
            .Select(x => new CustomerTableOptionDto(x.Id, x.Name, x.Capacity))
            .ToArrayAsync(cancellationToken);

    private static IQueryable<Order> IncludeOrderGraph(IQueryable<Order> query) =>
        query.Include(x => x.Items).ThenInclude(x => x.MenuItem)
            .Include(x => x.OrderTables).ThenInclude(x => x.Table);

    private async Task<Order> LoadOwnedTrackedOrderAsync(int userId, int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(db.Orders).Include(x => x.Payments)
            .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private async Task ReloadOrderAsync(Order order, CancellationToken cancellationToken)
    {
        await db.Entry(order).Collection(x => x.Items).Query().Include(x => x.MenuItem).LoadAsync(cancellationToken);
        await db.Entry(order).Collection(x => x.OrderTables).Query().Include(x => x.Table).LoadAsync(cancellationToken);
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

    private async Task<IReadOnlyCollection<Table>> ValidateAndLoadCustomerTablesAsync(
        OrderType orderType,
        int? tableId,
        IReadOnlyCollection<int> currentlyAssignedTableIds,
        CancellationToken cancellationToken)
    {
        if (orderType == OrderType.TakeAway)
        {
            return Array.Empty<Table>();
        }

        if (tableId is null or <= 0)
        {
            throw new ApiException("Dine-in orders require a table.");
        }

        var table = await db.Tables.SingleOrDefaultAsync(x => x.Id == tableId.Value, cancellationToken)
            ?? throw new ApiException("Table not found.", StatusCodes.Status404NotFound);

        if (!currentlyAssignedTableIds.Contains(table.Id) && table.Status != TableStatus.Available)
        {
            throw new ApiException("Only available tables can be assigned.", StatusCodes.Status409Conflict);
        }

        return [table];
    }

    private static void EnsureEditable(Order order)
    {
        if (order.PaymentStatus == PaymentStatus.Paid)
        {
            throw new ApiException("Paid orders cannot be modified.", StatusCodes.Status409Conflict);
        }

        if (order.Status == OrderStatus.Cancelled)
        {
            throw new ApiException("Cancelled orders cannot be modified.", StatusCodes.Status409Conflict);
        }
    }

    private static void AddOrderTables(Order order, IEnumerable<int> tableIds)
    {
        foreach (var tableId in tableIds.Distinct())
        {
            order.OrderTables.Add(new OrderTable { TableId = tableId });
        }
    }

    private static void MarkTablesOccupied(IEnumerable<Table> tables)
    {
        foreach (var table in tables)
        {
            table.Status = TableStatus.Occupied;
        }
    }

    private static void ReleaseAssignedTables(Order order)
    {
        foreach (var orderTable in order.OrderTables)
        {
            if (orderTable.Table.Status == TableStatus.Occupied)
            {
                orderTable.Table.Status = TableStatus.Available;
            }
        }
    }

    private static void RecalculateTotal(Order order) =>
        order.TotalPrice = order.Items.Sum(x => x.UnitPrice * x.Quantity);

    private async Task UpdatePaymentStatusAsync(Order order, CancellationToken cancellationToken)
    {
        var paid = order.Payments.Sum(x => x.Amount);
        if (order.Id > 0)
        {
            paid = await db.Payments.Where(x => x.OrderId == order.Id).SumAsync(x => x.Amount, cancellationToken);
        }

        order.PaymentStatus = paid >= order.TotalPrice ? PaymentStatus.Paid : PaymentStatus.Unpaid;
    }

    private async Task<OrderResponseDto> SendOrderUpdatedAsync(Order order, CancellationToken cancellationToken)
    {
        var response = order.ToOrderResponse();
        await realtimeNotifier.OrderUpdatedAsync(response, order.UserId, cancellationToken);
        return response;
    }
}
