using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class OrderTableAssignmentService(
    AppDbContext db,
    ILogger<OrderTableAssignmentService> logger) : IOrderTableAssignmentService
{
    public async Task AssignTablesForNewOrderAsync(
        Order order,
        OrderType orderType,
        IReadOnlyCollection<int>? tableIds,
        CancellationToken cancellationToken)
    {
        var requestedTableIds = NormalizeTableIds(orderType, tableIds);
        var lockedTables = await LoadAndLockTablesAsync(requestedTableIds, cancellationToken);
        await EnsureTablesCanBeAssignedAsync(lockedTables, requestedTableIds, new HashSet<int>(), null, cancellationToken);

        ReplaceOrderTableLinks(order, requestedTableIds);
        MarkRequestedTablesOccupied(lockedTables, requestedTableIds);
    }

    public async Task ReplaceTablesAsync(
        Order order,
        OrderType orderType,
        IReadOnlyCollection<int>? tableIds,
        CancellationToken cancellationToken)
    {
        var requestedTableIds = NormalizeTableIds(orderType, tableIds);
        var currentTableIds = order.OrderTables.Select(x => x.TableId).Distinct().ToArray();
        var affectedTableIds = currentTableIds.Concat(requestedTableIds).Distinct().ToArray();
        var lockedTables = await LoadAndLockTablesAsync(affectedTableIds, cancellationToken);
        var currentTableIdSet = currentTableIds.ToHashSet();

        await EnsureTablesCanBeAssignedAsync(lockedTables, requestedTableIds, currentTableIdSet, order.Id, cancellationToken);

        ReplaceOrderTableLinks(order, requestedTableIds);
        await ReconcileLockedTableStatusesAsync(lockedTables, requestedTableIds.ToHashSet(), order.Id, cancellationToken);
    }

    public async Task ReleaseTablesForClosedOrderAsync(Order order, CancellationToken cancellationToken)
    {
        var currentTableIds = order.OrderTables.Select(x => x.TableId).Distinct().ToArray();
        var lockedTables = await LoadAndLockTablesAsync(currentTableIds, cancellationToken);
        await ReconcileLockedTableStatusesAsync(lockedTables, new HashSet<int>(), order.Id, cancellationToken);
    }

    public async Task<Table> LoadTableForUpdateAsync(int id, CancellationToken cancellationToken) =>
        await TableForUpdate(id)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApiException("Table not found.", StatusCodes.Status404NotFound);

    private IQueryable<Table> TableForUpdate(int id) =>
        IsSqlServer()
            ? db.Tables.FromSqlInterpolated($"SELECT * FROM [Tables] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}")
            : db.Tables.Where(x => x.Id == id);

    public async Task EnsureManualStatusChangeIsSafeAsync(Table table, TableStatus requestedStatus, CancellationToken cancellationToken)
    {
        var hasActiveOrder = await HasActiveOrderAsync(table.Id, cancellationToken);
        if (hasActiveOrder && requestedStatus != TableStatus.Occupied)
        {
            throw new ApiException("Table is assigned to an active order and cannot be marked available or reserved.", StatusCodes.Status409Conflict);
        }

        if (!hasActiveOrder && requestedStatus == TableStatus.Occupied)
        {
            throw new ApiException("Table cannot be marked occupied without an active order.", StatusCodes.Status409Conflict);
        }
    }

    private async Task<Dictionary<int, Table>> LoadAndLockTablesAsync(IReadOnlyCollection<int> tableIds, CancellationToken cancellationToken)
    {
        var distinctTableIds = tableIds.Distinct().ToArray();
        if (distinctTableIds.Length == 0)
        {
            return new Dictionary<int, Table>();
        }

        var tables = IsSqlServer()
            ? await LoadAndLockSqlServerTablesAsync(distinctTableIds, cancellationToken)
            : await db.Tables.Where(x => distinctTableIds.Contains(x.Id)).ToArrayAsync(cancellationToken);
        var missingTableIds = distinctTableIds.Except(tables.Select(x => x.Id)).ToArray();
        if (missingTableIds.Length > 0)
        {
            throw new ApiException("One or more tables were not found.", StatusCodes.Status404NotFound);
        }

        return tables.ToDictionary(x => x.Id);
    }

    private async Task EnsureTablesCanBeAssignedAsync(
        IReadOnlyDictionary<int, Table> lockedTables,
        IReadOnlyCollection<int> requestedTableIds,
        IReadOnlySet<int> currentlyAssignedTableIds,
        int? currentOrderId,
        CancellationToken cancellationToken)
    {
        if (requestedTableIds.Count == 0)
        {
            return;
        }

        var tableIdsWithOtherActiveOrders = await LoadTableIdsWithActiveOrdersAsync(requestedTableIds, currentOrderId, cancellationToken);
        if (tableIdsWithOtherActiveOrders.Count > 0)
        {
            LogRejectedAssignment(tableIdsWithOtherActiveOrders, "ActiveOrderAlreadyAssigned");
            throw new ApiException("Table is already assigned to an active order.", StatusCodes.Status409Conflict);
        }

        var unavailableTables = requestedTableIds
            .Select(id => lockedTables[id])
            .Where(table => !currentlyAssignedTableIds.Contains(table.Id) && table.Status != TableStatus.Available)
            .Select(table => table.Name)
            .ToArray();

        if (unavailableTables.Length > 0)
        {
            logger.LogWarning("Rejected table assignment because tables are not available: {TableNames}", unavailableTables);
            throw new ApiException("Only available tables can be assigned to an order.", StatusCodes.Status409Conflict);
        }
    }

    private async Task ReconcileLockedTableStatusesAsync(
        IReadOnlyDictionary<int, Table> lockedTables,
        IReadOnlySet<int> requestedTableIds,
        int currentOrderId,
        CancellationToken cancellationToken)
    {
        if (lockedTables.Count == 0)
        {
            return;
        }

        var tableIdsWithOtherActiveOrders = await LoadTableIdsWithActiveOrdersAsync(lockedTables.Keys, currentOrderId, cancellationToken);
        foreach (var table in lockedTables.Values)
        {
            if (requestedTableIds.Contains(table.Id) || tableIdsWithOtherActiveOrders.Contains(table.Id))
            {
                table.Status = TableStatus.Occupied;
            }
            else if (table.Status == TableStatus.Occupied)
            {
                table.Status = TableStatus.Available;
            }
        }
    }

    private async Task<HashSet<int>> LoadTableIdsWithActiveOrdersAsync(
        IEnumerable<int> tableIds,
        int? exceptOrderId,
        CancellationToken cancellationToken)
    {
        var distinctTableIds = tableIds.Distinct().ToArray();
        if (distinctTableIds.Length == 0)
        {
            return new HashSet<int>();
        }

        var query = db.OrderTables.Where(x =>
            distinctTableIds.Contains(x.TableId) &&
            x.Order.Status == OrderStatus.Open);

        if (exceptOrderId.HasValue)
        {
            query = query.Where(x => x.OrderId != exceptOrderId.Value);
        }

        var activeTableIds = await query.Select(x => x.TableId).Distinct().ToArrayAsync(cancellationToken);
        return activeTableIds.ToHashSet();
    }

    private async Task<bool> HasActiveOrderAsync(int tableId, CancellationToken cancellationToken) =>
        await db.OrderTables.AnyAsync(x =>
            x.TableId == tableId &&
            x.Order.Status == OrderStatus.Open,
            cancellationToken);

    private static int[] NormalizeTableIds(OrderType orderType, IReadOnlyCollection<int>? tableIds)
    {
        var requestedTableIds = tableIds?.Where(x => x > 0).Distinct().ToArray() ?? Array.Empty<int>();
        if (tableIds is not null && requestedTableIds.Length != tableIds.Count)
        {
            throw new ApiException("Table list is invalid.");
        }

        if (orderType == OrderType.TakeAway)
        {
            if (requestedTableIds.Length > 0)
            {
                throw new ApiException("Takeaway orders cannot be assigned to tables.", StatusCodes.Status409Conflict);
            }

            return Array.Empty<int>();
        }

        if (requestedTableIds.Length == 0)
        {
            throw new ApiException("Dine-in orders must have at least one table.");
        }

        return requestedTableIds;
    }

    private static void ReplaceOrderTableLinks(Order order, IReadOnlyCollection<int> requestedTableIds)
    {
        var requestedTableIdSet = requestedTableIds.ToHashSet();
        foreach (var removedOrderTable in order.OrderTables.Where(x => !requestedTableIdSet.Contains(x.TableId)).ToArray())
        {
            order.OrderTables.Remove(removedOrderTable);
        }

        var existingTableIds = order.OrderTables.Select(x => x.TableId).ToHashSet();
        foreach (var tableId in requestedTableIds.Where(x => !existingTableIds.Contains(x)))
        {
            order.OrderTables.Add(new OrderTable { TableId = tableId });
        }
    }

    private static void MarkRequestedTablesOccupied(IReadOnlyDictionary<int, Table> lockedTables, IReadOnlyCollection<int> requestedTableIds)
    {
        foreach (var tableId in requestedTableIds)
        {
            lockedTables[tableId].Status = TableStatus.Occupied;
        }
    }

    private void LogRejectedAssignment(IReadOnlySet<int> tableIds, string reason) =>
        logger.LogWarning("Rejected table assignment for tables {TableIds}. Reason {Reason}", tableIds, reason);

    private async Task<Table[]> LoadAndLockSqlServerTablesAsync(int[] distinctTableIds, CancellationToken cancellationToken)
    {
        var parameters = distinctTableIds
            .Select((id, index) => (object)new SqlParameter($"@id{index}", id))
            .ToArray();
        var parameterNames = string.Join(", ", parameters.Cast<SqlParameter>().Select(x => x.ParameterName));
        var sql = $"SELECT * FROM [Tables] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] IN ({parameterNames})";
        return await db.Tables.FromSqlRaw(sql, parameters).ToArrayAsync(cancellationToken);
    }

    private bool IsSqlServer() =>
        string.Equals(db.Database.ProviderName, "Microsoft.EntityFrameworkCore.SqlServer", StringComparison.Ordinal);
}
