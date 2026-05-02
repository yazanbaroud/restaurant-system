using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class OrdersService(
    AppDbContext db,
    IOrderTableAssignmentService tableAssignments,
    IOrderStateService orderState,
    IAuditService audit,
    IRestaurantRealtimeNotifier realtimeNotifier,
    ILogger<OrdersService> logger) : IOrdersService
{
    public async Task<OrderResponseDto> CreateAsync(int createdByUserId, CreateOrderDto dto, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(createdByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var menuItems = await LoadMenuItemsAsync(dto.Items.Select(x => x.MenuItemId), cancellationToken);
            var now = DateTime.UtcNow;
            var order = new Order
            {
                UserId = createdByUserId,
                CustomerFirstName = dto.CustomerFirstName?.Trim() ?? string.Empty,
                CustomerLastName = dto.CustomerLastName?.Trim() ?? string.Empty,
                Notes = dto.Notes?.Trim(),
                CreatedAt = now,
                OrderNumber = OrderNumberGenerator.Create(now),
                OrderType = dto.OrderType
            };

            orderState.Initialize(order, createdByUserId, now);
            AddItems(order, dto.Items, menuItems);
            await tableAssignments.AssignTablesForNewOrderAsync(order, dto.OrderType, dto.TableIds, cancellationToken);
            RecalculateTotal(order);

            db.Orders.Add(order);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await ReloadOrderAsync(order, cancellationToken);
            await LogOrderCreatedAsync(order, createdByUserId, cancellationToken);
            await LogTableAssignmentChangeAsync(order, createdByUserId, [], TableIds(order), cancellationToken);
            logger.LogInformation("Order created with id {OrderId} and number {OrderNumber} by user {UserId}", order.Id, order.OrderNumber, createdByUserId);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderCreatedAsync(response, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order creation concurrency conflict by user {UserId}", createdByUserId);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order creation SQL concurrency conflict by user {UserId}", createdByUserId);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyCollection<OrderResponseDto>> GetAllAsync(
        OrderStatus? status,
        KitchenStatus? kitchenStatus,
        DateOnly? date,
        DateOnly? from,
        DateOnly? to,
        PaymentStatus? paymentStatus,
        OrderType? orderType,
        bool activeOnly,
        CancellationToken cancellationToken)
    {
        var query = IncludeOrderGraph(db.Orders.AsNoTracking());
        if (activeOnly) query = query.Where(x => x.Status == OrderStatus.Open);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (kitchenStatus.HasValue) query = query.Where(x => x.KitchenStatus == kitchenStatus.Value);
        if (paymentStatus.HasValue) query = query.Where(x => x.PaymentStatus == paymentStatus.Value);
        if (orderType.HasValue) query = query.Where(x => x.OrderType == orderType.Value);
        if (date.HasValue)
        {
            var start = date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = start.AddDays(1);
            query = query.Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        }

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            throw new ApiException("Start date must be before or equal to end date.");
        }

        if (from.HasValue)
        {
            var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(x => x.CreatedAt >= start);
        }

        if (to.HasValue)
        {
            var end = to.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(1);
            query = query.Where(x => x.CreatedAt < end);
        }

        var orders = await query.OrderByDescending(x => x.CreatedAt).ToArrayAsync(cancellationToken);
        return orders.Select(x => x.ToOrderResponse()).ToArray();
    }

    public async Task<PagedResponseDto<OrderResponseDto>> GetPagedAsync(
        OrderStatus? status,
        KitchenStatus? kitchenStatus,
        DateOnly? date,
        DateOnly? from,
        DateOnly? to,
        PaymentStatus? paymentStatus,
        OrderType? orderType,
        bool activeOnly,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = FilterOrders(IncludeOrderGraph(db.Orders.AsNoTracking()), status, kitchenStatus, date, from, to, paymentStatus, orderType, activeOnly);
        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 1, 100);
        var totalCount = await query.CountAsync(cancellationToken);
        var orders = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToArrayAsync(cancellationToken);

        return new PagedResponseDto<OrderResponseDto>(safePage, safePageSize, totalCount, orders.Select(x => x.ToOrderResponse()).ToArray());
    }

    public async Task<IReadOnlyCollection<OrderResponseDto>> GetSaladsAsync(CancellationToken cancellationToken)
    {
        var orders = await IncludeOrderGraph(db.Orders.AsNoTracking())
            .Where(x => x.Status == OrderStatus.Open && x.KitchenStatus == KitchenStatus.InSalads)
            .OrderBy(x => x.CreatedAt)
            .ToArrayAsync(cancellationToken);

        return orders.Select(x => x.ToOrderResponse()).ToArray();
    }

    public async Task<IReadOnlyCollection<OrderResponseDto>> GetKitchenAsync(CancellationToken cancellationToken)
    {
        var orders = await IncludeOrderGraph(db.Orders.AsNoTracking())
            .Where(x => x.Status == OrderStatus.Open && (x.KitchenStatus == KitchenStatus.InKitchen || x.KitchenStatus == KitchenStatus.Ready))
            .OrderBy(x => x.CreatedAt)
            .ToArrayAsync(cancellationToken);

        return orders.Select(x => x.ToOrderResponse()).ToArray();
    }

    public async Task<OrderResponseDto> GetByIdAsync(int id, bool activeOnly, CancellationToken cancellationToken)
    {
        var query = IncludeOrderGraph(db.Orders.AsNoTracking());
        if (activeOnly) query = query.Where(x => x.Status == OrderStatus.Open);

        var order = await query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);
        return order.ToOrderResponse();
    }

    public async Task<OrderResponseDto> UpdateAsync(int id, UpdateOrderDto dto, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            var oldValues = OrderAuditSnapshot(order);
            var oldTableIds = TableIds(order);
            orderState.EnsureItemsCanBeChanged(order);
            var tableIds = dto.OrderType == OrderType.TakeAway
                ? Array.Empty<int>()
                : order.OrderTables.Select(x => x.TableId).ToArray();

            await tableAssignments.ReplaceTablesAsync(order, dto.OrderType, tableIds, cancellationToken);
            order.CustomerFirstName = dto.CustomerFirstName?.Trim() ?? string.Empty;
            order.CustomerLastName = dto.CustomerLastName?.Trim() ?? string.Empty;
            order.Notes = dto.Notes?.Trim();
            order.OrderType = dto.OrderType;

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);
            await audit.TryLogAsync(
                new AuditLogEntry(AuditEntityTypes.Order, order.Id, AuditActions.Update, OldValues: oldValues, NewValues: OrderAuditSnapshot(order)),
                cancellationToken);
            await LogTableAssignmentChangeAsync(order, null, oldTableIds, TableIds(order), cancellationToken);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderUpdatedAsync(response, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} update concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} update SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public Task<OrderResponseDto> AdvanceSaladStatusAsync(int id, int changedByUserId, CancellationToken cancellationToken) =>
        AdvanceKitchenStatusCoreAsync(
            id,
            changedByUserId,
            order =>
            {
                if (order.KitchenStatus != KitchenStatus.InSalads)
                {
                    throw new ApiException("Only orders in salads can be advanced from the salad screen.", StatusCodes.Status409Conflict);
                }
            },
            cancellationToken);

    public Task<OrderResponseDto> AdvanceKitchenStatusAsync(int id, int changedByUserId, CancellationToken cancellationToken) =>
        AdvanceKitchenStatusCoreAsync(
            id,
            changedByUserId,
            order =>
            {
                if (order.KitchenStatus is not (KitchenStatus.InKitchen or KitchenStatus.Ready))
                {
                    throw new ApiException("Only orders in the kitchen or ready state can be advanced by kitchen staff.", StatusCodes.Status409Conflict);
                }
            },
            cancellationToken);

    private async Task<OrderResponseDto> AdvanceKitchenStatusCoreAsync(
        int id,
        int changedByUserId,
        Action<Order> validateCurrentState,
        CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(changedByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            validateCurrentState(order);
            var oldStatusValues = OrderStatusSnapshot(order);
            var oldTableIds = TableIds(order);
            var completed = orderState.AdvanceKitchenStatus(order, changedByUserId, DateTime.UtcNow);
            if (completed)
            {
                await tableAssignments.ReleaseTablesForClosedOrderAsync(order, cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            await LogOrderStatusChangeAsync(order, changedByUserId, oldStatusValues, cancellationToken);
            await LogTableAssignmentChangeAsync(order, changedByUserId, oldTableIds, TableIds(order), cancellationToken);
            logger.LogInformation("Order {OrderId} kitchen status advanced to {KitchenStatus}", order.Id, order.KitchenStatus);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderStatusUpdatedAsync(response, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} kitchen status concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} kitchen status SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<OrderResponseDto> MarkPaidAsync(int id, int changedByUserId, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(changedByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            var oldStatusValues = OrderStatusSnapshot(order);
            var oldTableIds = TableIds(order);
            var paidAmount = await SumPaymentsAsync(id, cancellationToken);
            var completed = orderState.MarkPaidFromExistingPayments(order, paidAmount, changedByUserId, DateTime.UtcNow);
            if (completed)
            {
                await tableAssignments.ReleaseTablesForClosedOrderAsync(order, cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            await LogOrderStatusChangeAsync(order, changedByUserId, oldStatusValues, cancellationToken);
            await LogTableAssignmentChangeAsync(order, changedByUserId, oldTableIds, TableIds(order), cancellationToken);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderStatusUpdatedAsync(response, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} mark-paid concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} mark-paid SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<OrderResponseDto> CancelAsync(int id, int changedByUserId, CancellationToken cancellationToken)
    {
        EnsureAuthenticatedUser(changedByUserId);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            var oldStatusValues = OrderStatusSnapshot(order);
            var oldTableIds = TableIds(order);
            orderState.Cancel(order, changedByUserId, DateTime.UtcNow);
            await tableAssignments.ReleaseTablesForClosedOrderAsync(order, cancellationToken);

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);

            await audit.TryLogAsync(
                new AuditLogEntry(AuditEntityTypes.Order, order.Id, AuditActions.Cancelled, changedByUserId, oldStatusValues, OrderStatusSnapshot(order)),
                cancellationToken);
            await LogTableAssignmentChangeAsync(order, changedByUserId, oldTableIds, TableIds(order), cancellationToken);
            logger.LogInformation("Order {OrderId} cancelled by user {UserId}", order.Id, changedByUserId);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderStatusUpdatedAsync(response, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} cancellation concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} cancellation SQL concurrency conflict", id);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public Task<OrderResponseDto> AddItemAsync(int id, AddOrderItemDto dto, CancellationToken cancellationToken) =>
        MutateOrderItemsAsync(
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

    public Task<OrderResponseDto> UpdateItemAsync(int id, int itemId, UpdateOrderItemDto dto, CancellationToken cancellationToken) =>
        MutateOrderItemsAsync(
            id,
            (order, _) =>
            {
                var item = order.Items.SingleOrDefault(x => x.Id == itemId)
                    ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);
                item.Quantity = dto.Quantity;
                item.Notes = dto.Notes?.Trim();
                item.Status = OrderItemStatus.Pending;
                return Task.CompletedTask;
            },
            "item update",
            cancellationToken);

    public Task<OrderResponseDto> DeleteItemAsync(int id, int itemId, CancellationToken cancellationToken) =>
        MutateOrderItemsAsync(
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

    public Task<OrderResponseDto> UpdateItemStatusAsync(int id, int itemId, int changedByUserId, UpdateOrderItemStatusDto dto, CancellationToken cancellationToken) =>
        MutateOrderItemsAsync(
            id,
            (order, _) =>
            {
                var item = order.Items.SingleOrDefault(x => x.Id == itemId)
                    ?? throw new ApiException("Order item not found.", StatusCodes.Status404NotFound);

                orderState.ApplyOrderItemStatus(order, item, dto.Status, changedByUserId, DateTime.UtcNow);
                return Task.CompletedTask;
            },
            "item status update",
            cancellationToken);

    public async Task<OrderResponseDto> UpdateTablesAsync(int id, UpdateOrderTablesDto dto, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            var oldTableIds = TableIds(order);
            orderState.EnsureItemsCanBeChanged(order);
            await tableAssignments.ReplaceTablesAsync(order, order.OrderType, dto.TableIds, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);
            await LogTableAssignmentChangeAsync(order, null, oldTableIds, TableIds(order), cancellationToken);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderUpdatedAsync(response, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} table update concurrency conflict", id);
            throw new ApiException("Order tables were updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} table update SQL concurrency conflict", id);
            throw new ApiException("Order tables were updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    private static IQueryable<Order> IncludeOrderGraph(IQueryable<Order> query) =>
        query.Include(x => x.Items).ThenInclude(x => x.MenuItem)
            .Include(x => x.OrderTables).ThenInclude(x => x.Table)
            .Include(x => x.StatusChanges)
            .Include(x => x.User);

    private static IQueryable<Order> FilterOrders(
        IQueryable<Order> query,
        OrderStatus? status,
        KitchenStatus? kitchenStatus,
        DateOnly? date,
        DateOnly? from,
        DateOnly? to,
        PaymentStatus? paymentStatus,
        OrderType? orderType,
        bool activeOnly)
    {
        if (activeOnly) query = query.Where(x => x.Status == OrderStatus.Open);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (kitchenStatus.HasValue) query = query.Where(x => x.KitchenStatus == kitchenStatus.Value);
        if (paymentStatus.HasValue) query = query.Where(x => x.PaymentStatus == paymentStatus.Value);
        if (orderType.HasValue) query = query.Where(x => x.OrderType == orderType.Value);
        if (date.HasValue)
        {
            var start = date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = start.AddDays(1);
            query = query.Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        }

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            throw new ApiException("Start date must be before or equal to end date.");
        }

        if (from.HasValue)
        {
            var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(x => x.CreatedAt >= start);
        }

        if (to.HasValue)
        {
            var end = to.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(1);
            query = query.Where(x => x.CreatedAt < end);
        }

        return query;
    }

    private async Task<Order> LoadTrackedOrderAsync(int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(db.Orders).Include(x => x.Payments).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private async Task<Order> LoadTrackedOrderForUpdateAsync(int id, CancellationToken cancellationToken) =>
        await IncludeOrderGraph(OrdersForUpdate(id))
            .Include(x => x.Payments)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

    private IQueryable<Order> OrdersForUpdate(int id) =>
        IsSqlServer()
            ? db.Orders.FromSqlInterpolated($"SELECT * FROM [Orders] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}")
            : db.Orders.Where(x => x.Id == id);

    private async Task<OrderResponseDto> MutateOrderItemsAsync(
        int id,
        Func<Order, CancellationToken, Task> mutate,
        string operation,
        CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var order = await LoadTrackedOrderForUpdateAsync(id, cancellationToken);
            orderState.EnsureItemsCanBeChanged(order);
            await mutate(order, cancellationToken);
            RecalculateTotal(order);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await ReloadOrderAsync(order, cancellationToken);
            var response = order.ToOrderResponse();
            await realtimeNotifier.OrderUpdatedAsync(response, cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} {Operation} concurrency conflict", id, operation);
            throw new ApiException("Order was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Order {OrderId} {Operation} SQL concurrency conflict", id, operation);
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
        await db.Entry(order).Reference(x => x.User).LoadAsync(cancellationToken);
    }

    private async Task<Dictionary<int, MenuItem>> LoadMenuItemsAsync(IEnumerable<int> ids, CancellationToken cancellationToken)
    {
        var distinctIds = ids.Distinct().ToArray();
        var activeCategoryIds = await db.MenuCategories.AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => x.Id)
            .ToArrayAsync(cancellationToken);
        var activeCategorySet = activeCategoryIds.ToHashSet();
        var items = await db.MenuItems
            .Where(x => distinctIds.Contains(x.Id) && x.IsAvailable)
            .ToArrayAsync(cancellationToken);
        var availableItems = items.Where(x => activeCategorySet.Contains(x.Category)).ToDictionary(x => x.Id);
        if (availableItems.Count != distinctIds.Length)
        {
            throw new ApiException("One or more menu items were not found or are unavailable.");
        }

        return availableItems;
    }

    private async Task<MenuItem> LoadAvailableMenuItemAsync(int id, CancellationToken cancellationToken) =>
        (await LoadMenuItemsAsync([id], cancellationToken))[id];

    private async Task LogOrderCreatedAsync(Order order, int createdByUserId, CancellationToken cancellationToken) =>
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Order, order.Id, AuditActions.Create, createdByUserId, NewValues: OrderAuditSnapshot(order)),
            cancellationToken);

    private async Task LogOrderStatusChangeAsync(
        Order order,
        int changedByUserId,
        OrderStatusAuditValues oldValues,
        CancellationToken cancellationToken)
    {
        var newValues = OrderStatusSnapshot(order);
        if (oldValues == newValues)
        {
            return;
        }

        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Order, order.Id, AuditActions.StatusChange, changedByUserId, oldValues, newValues),
            cancellationToken);
    }

    private async Task LogTableAssignmentChangeAsync(
        Order order,
        int? changedByUserId,
        IReadOnlyCollection<int> oldTableIds,
        IReadOnlyCollection<int> newTableIds,
        CancellationToken cancellationToken)
    {
        if (SameTableIds(oldTableIds, newTableIds))
        {
            return;
        }

        var oldValues = new { TableIds = oldTableIds.OrderBy(x => x).ToArray() };
        var newValues = new { TableIds = newTableIds.OrderBy(x => x).ToArray() };
        await audit.TryLogAsync(
            new AuditLogEntry(AuditEntityTypes.Order, order.Id, AuditActions.TableAssignmentChanged, changedByUserId, oldValues, newValues),
            cancellationToken);

        foreach (var tableId in oldTableIds.Concat(newTableIds).Distinct().OrderBy(x => x))
        {
            var wasAssigned = oldTableIds.Contains(tableId);
            var isAssigned = newTableIds.Contains(tableId);
            await audit.TryLogAsync(
                new AuditLogEntry(
                    AuditEntityTypes.Table,
                    tableId,
                    AuditActions.TableAssignmentChanged,
                    changedByUserId,
                    new { OrderId = wasAssigned ? order.Id : (int?)null, Assigned = wasAssigned },
                    new { OrderId = isAssigned ? order.Id : (int?)null, Assigned = isAssigned }),
                cancellationToken);
        }
    }

    private static OrderAuditValues OrderAuditSnapshot(Order order) =>
        new(
            order.OrderNumber,
            order.OrderType.ToString(),
            order.Status.ToString(),
            order.KitchenStatus.ToString(),
            order.PaymentStatus.ToString(),
            order.TotalAmount,
            TableIds(order),
            order.Items.Count);

    private static OrderStatusAuditValues OrderStatusSnapshot(Order order) =>
        new(order.Status.ToString(), order.KitchenStatus.ToString(), order.PaymentStatus.ToString());

    private static int[] TableIds(Order order) =>
        order.OrderTables.Select(x => x.TableId).OrderBy(x => x).ToArray();

    private static bool SameTableIds(IReadOnlyCollection<int> left, IReadOnlyCollection<int> right) =>
        left.Count == right.Count && left.OrderBy(x => x).SequenceEqual(right.OrderBy(x => x));

    private static void AddItems(Order order, IEnumerable<CreateOrderItemDto> items, IReadOnlyDictionary<int, MenuItem> menuItems)
    {
        foreach (var item in items)
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
    }

    private static void EnsureAuthenticatedUser(int userId)
    {
        if (userId <= 0)
        {
            throw new ApiException("Authenticated user was not found.", StatusCodes.Status401Unauthorized);
        }
    }

    private async Task RollbackQuietlyAsync(IDbContextTransaction transaction, CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Failed to roll back order transaction");
        }
    }

    private static void RecalculateTotal(Order order) =>
        order.TotalAmount = order.Items.Sum(x => x.UnitPrice * x.Quantity);

    private async Task<decimal> SumPaymentsAsync(int orderId, CancellationToken cancellationToken)
    {
        var query = db.Payments.AsNoTracking()
            .Where(x => x.OrderId == orderId);

        if (IsSqlite())
        {
            var amounts = await query.Select(x => x.Amount).ToArrayAsync(cancellationToken);
            return amounts.Sum();
        }

        return await query.SumAsync(x => x.Amount, cancellationToken);
    }

    private static bool IsSqlConcurrencyFailure(DbUpdateException exception) =>
        exception.InnerException is SqlException sqlException &&
        sqlException.Errors.Cast<SqlError>().Any(error => error.Number == 1205);

    private bool IsSqlServer() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.SqlServer", StringComparison.Ordinal);

    private bool IsSqlite() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.Sqlite", StringComparison.Ordinal);

    private sealed record OrderAuditValues(
        string OrderNumber,
        string OrderType,
        string OrderStatus,
        string KitchenStatus,
        string PaymentStatus,
        decimal TotalAmount,
        IReadOnlyCollection<int> TableIds,
        int ItemCount);

    private sealed record OrderStatusAuditValues(string OrderStatus, string KitchenStatus, string PaymentStatus);
}
