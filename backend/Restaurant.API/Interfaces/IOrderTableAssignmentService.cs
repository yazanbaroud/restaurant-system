using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Models;

namespace Restaurant.API.Interfaces;

public interface IOrderTableAssignmentService
{
    Task AssignTablesForNewOrderAsync(Order order, OrderType orderType, IReadOnlyCollection<int>? tableIds, CancellationToken cancellationToken);
    Task ReplaceTablesAsync(Order order, OrderType orderType, IReadOnlyCollection<int>? tableIds, CancellationToken cancellationToken);
    Task ReleaseTablesForClosedOrderAsync(Order order, CancellationToken cancellationToken);
    Task<Table> LoadTableForUpdateAsync(int id, CancellationToken cancellationToken);
    Task EnsureManualStatusChangeIsSafeAsync(Table table, TableStatus requestedStatus, CancellationToken cancellationToken);
}
