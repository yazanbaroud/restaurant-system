using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Hubs;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class OrdersService(
    AppDbContext db,
    IHubContext<RestaurantHub> hub,
    ILogger<OrdersService> logger) : IOrdersService
{
    public async Task<OrderResponseDto> CreateAsync(CreateOrderDto dto, CancellationToken cancellationToken)
    {
        var assignedTables = await ValidateAndLoadAssignableTablesAsync(dto.OrderType, dto.TableIds, Array.Empty<int>(), cancellationToken);

        var menuItems = await LoadMenuItemsAsync(dto.Items.Select(x => x.MenuItemId), cancellationToken);
        var order = new Order
        {
            UserId = dto.UserId,
            CustomerFirstName = dto.CustomerFirstName?.Trim() ?? string.Empty,
            CustomerLastName = dto.CustomerLastName?.Trim() ?? string.Empty,
            Notes = dto.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            OrderNumber = OrderNumberGenerator.Create(DateTime.UtcNow),
            OrderType = dto.OrderType,
            Status = OrderStatus.InSalads,
            PaymentStatus = PaymentStatus.Unpaid
        };

        foreach (var item in dto.Items)
        {
            var menuItem = menuItems[item.MenuItemId];
            order.Items.Add(new OrderItem
            {
                MenuItemId = item.MenuItemId,
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
        logger.LogInformation("Order created with id {OrderId} and number {OrderNumber}", order.Id, order.OrderNumber);
        await hub.Clients.All.SendAsync("orderCreated", order.ToOrderResponse(), cancellationToken);
        return order.ToOrderResponse();
    }

    public async Task<IReadOnlyCollection<OrderResponseDto>> GetAllAsync(OrderStatus? status, DateOnly? date, PaymentStatus? paymentStatus, OrderType? orderType, bool activeOnly, CancellationToken cancellationToken)
    {
        var query = IncludeOrderGraph(db.Orders.AsNoTracking());
        if (activeOnly) query = query.Where(x => x.Status == OrderStatus.InSalads || x.Status == OrderStatus.InMain);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (paymentStatus.HasValue) query = query.Where(x => x.PaymentStatus == paymentStatus.Value);
        if (orderType.HasValue) query = query.Where(x => x.OrderType == orderType.Value);
        if (date.HasValue)
        {
            var start = date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = start.AddDays(1);
            query = query.Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        }

        var orders = await query.OrderByDescending(x => x.CreatedAt).ToArrayAsync(cancellationToken);
        return orders.Select(x => x.ToOrderResponse()).ToArray();
    }

    public async Task<OrderResponseDto> GetByIdAsync(int id, bool activeOnly, CancellationToken cancellationToken)
    {
        var query = IncludeOrderGraph(db.Orders.AsNoTracking());
        if (activeOnly) query = query.Where(x => x.Status == OrderStatus.InSalads || x.Status == OrderStatus.InMain);

        var order = await query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);
        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> UpdateAsync(int id, UpdateOrderDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadTrackedOrderAsync(id, cancellationToken);
        await ValidateAndLoadAssignableTablesAsync(dto.OrderType, order.OrderTables.Select(x => x.TableId).ToArray(), order.OrderTables.Select(x => x.TableId).ToArray(), cancellationToken);
        order.CustomerFirstName = dto.CustomerFirstName?.Trim() ?? string.Empty;
        order.CustomerLastName = dto.CustomerLastName?.Trim() ?? string.Empty;
        order.Notes = dto.Notes?.Trim();
        order.OrderType = dto.OrderType;
        await db.SaveChangesAsync(cancellationToken);
        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> UpdateStatusAsync(int id, UpdateOrderStatusDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadTrackedOrderAsync(id, cancellationToken);
        var previousStatus = order.Status;
        order.Status = dto.Status;

        if (IsClosedStatus(dto.Status))
        {
            ReleaseAssignedTables(order);
        }
        else if (IsClosedStatus(previousStatus) && order.OrderTables.Count > 0)
        {
            var assignedTables = await ValidateAndLoadAssignableTablesAsync(order.OrderType, order.OrderTables.Select(x => x.TableId).ToArray(), Array.Empty<int>(), cancellationToken);
            MarkTablesOccupied(assignedTables);
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Order {OrderId} status updated to {Status}", order.Id, order.Status);
        var response = order.ToOrderResponse();
        await hub.Clients.All.SendAsync("orderStatusUpdated", response, cancellationToken);
        return response;
    }

    public async Task<OrderResponseDto> AddItemAsync(int id, AddOrderItemDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadTrackedOrderAsync(id, cancellationToken);
        var menuItem = await db.MenuItems.SingleOrDefaultAsync(x => x.Id == dto.MenuItemId && x.IsAvailable, cancellationToken)
            ?? throw new ApiException("Menu item not found or unavailable.", StatusCodes.Status404NotFound);
        order.Items.Add(new OrderItem { MenuItemId = menuItem.Id, Quantity = dto.Quantity, UnitPrice = menuItem.Price, Notes = dto.Notes?.Trim() });
        RecalculateTotal(order);
        await UpdatePaymentStatusAsync(order, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ReloadOrderAsync(order, cancellationToken);
        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> UpdateItemAsync(int id, int itemId, UpdateOrderItemDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadTrackedOrderAsync(id, cancellationToken);
        var item = order.Items.SingleOrDefault(x => x.Id == itemId)
            ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);
        item.Quantity = dto.Quantity;
        item.Notes = dto.Notes?.Trim();
        RecalculateTotal(order);
        await UpdatePaymentStatusAsync(order, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> DeleteItemAsync(int id, int itemId, CancellationToken cancellationToken)
    {
        var order = await LoadTrackedOrderAsync(id, cancellationToken);
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
        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> UpdateTablesAsync(int id, UpdateOrderTablesDto dto, CancellationToken cancellationToken)
    {
        var order = await LoadTrackedOrderAsync(id, cancellationToken);
        var currentTableIds = order.OrderTables.Select(x => x.TableId).ToArray();
        var assignedTables = await ValidateAndLoadAssignableTablesAsync(order.OrderType, dto.TableIds, currentTableIds, cancellationToken);
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
        await db.SaveChangesAsync(cancellationToken);
        await ReloadOrderAsync(order, cancellationToken);
        return order.ToOrderResponse();
    }

    private static IQueryable<Order> IncludeOrderGraph(IQueryable<Order> query) =>
        query.Include(x => x.Items).ThenInclude(x => x.MenuItem)
            .Include(x => x.OrderTables).ThenInclude(x => x.Table);

    private async Task<Order> LoadTrackedOrderAsync(int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(db.Orders).Include(x => x.Payments).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private async Task ReloadOrderAsync(Order order, CancellationToken cancellationToken)
    {
        await db.Entry(order).Collection(x => x.Items).Query().Include(x => x.MenuItem).LoadAsync(cancellationToken);
        await db.Entry(order).Collection(x => x.OrderTables).Query().Include(x => x.Table).LoadAsync(cancellationToken);
    }

    private async Task<Dictionary<int, MenuItem>> LoadMenuItemsAsync(IEnumerable<int> ids, CancellationToken cancellationToken)
    {
        var distinctIds = ids.Distinct().ToArray();
        var items = await db.MenuItems.Where(x => distinctIds.Contains(x.Id) && x.IsAvailable).ToDictionaryAsync(x => x.Id, cancellationToken);
        if (items.Count != distinctIds.Length)
        {
            throw new ApiException("One or more menu items were not found or are unavailable.");
        }
        return items;
    }

    private static void ValidateTablesForOrder(OrderType orderType, IReadOnlyCollection<int>? tableIds)
    {
        if (orderType == OrderType.DineIn && (tableIds is null || tableIds.Count == 0))
        {
            throw new ApiException("Dine-in orders require at least one table.");
        }
    }

    private async Task<IReadOnlyCollection<Table>> ValidateAndLoadAssignableTablesAsync(
        OrderType orderType,
        IReadOnlyCollection<int>? tableIds,
        IReadOnlyCollection<int> currentlyAssignedTableIds,
        CancellationToken cancellationToken)
    {
        ValidateTablesForOrder(orderType, tableIds);

        var distinctTableIds = tableIds?.Where(x => x > 0).Distinct().ToArray() ?? Array.Empty<int>();
        if (distinctTableIds.Length == 0)
        {
            return Array.Empty<Table>();
        }

        if (tableIds is not null && distinctTableIds.Length != tableIds.Count)
        {
            throw new ApiException("Table IDs must be positive and unique.");
        }

        var tables = await db.Tables.Where(x => distinctTableIds.Contains(x.Id)).ToArrayAsync(cancellationToken);
        var missingTableIds = distinctTableIds.Except(tables.Select(x => x.Id)).ToArray();
        if (missingTableIds.Length > 0)
        {
            throw new ApiException($"Table IDs were not found: {string.Join(", ", missingTableIds)}.", StatusCodes.Status404NotFound);
        }

        var currentIds = currentlyAssignedTableIds.ToHashSet();
        var unavailableTables = tables
            .Where(x => !currentIds.Contains(x.Id) && x.Status != TableStatus.Available)
            .Select(x => x.Name)
            .ToArray();

        if (unavailableTables.Length > 0)
        {
            throw new ApiException($"Only available tables can be assigned. Unavailable table(s): {string.Join(", ", unavailableTables)}.", StatusCodes.Status409Conflict);
        }

        return tables;
    }

    private static void AddOrderTables(Order order, IEnumerable<int>? tableIds)
    {
        foreach (var tableId in tableIds?.Distinct() ?? Enumerable.Empty<int>())
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

    private static bool IsClosedStatus(OrderStatus status) =>
        status is OrderStatus.Completed or OrderStatus.Cancelled;

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
}
