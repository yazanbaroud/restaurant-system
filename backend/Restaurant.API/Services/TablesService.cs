using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class TablesService(AppDbContext db, ILogger<TablesService> logger) : ITablesService
{
    public async Task<IReadOnlyCollection<TableResponseDto>> GetAllAsync(CancellationToken cancellationToken) =>
        await db.Tables.AsNoTracking().OrderBy(x => x.Name).Select(x => x.ToTableResponse()).ToArrayAsync(cancellationToken);

    public async Task<TableResponseDto> CreateAsync(CreateTableDto dto, CancellationToken cancellationToken)
    {
        var name = dto.Name.Trim();
        if (await db.Tables.AnyAsync(x => x.Name == name, cancellationToken))
        {
            throw new ApiException("A table with this name already exists.", StatusCodes.Status409Conflict);
        }

        var table = new Table { Name = name, Capacity = dto.Capacity, Status = TableStatus.Available };
        db.Tables.Add(table);
        await db.SaveChangesAsync(cancellationToken);
        return table.ToTableResponse();
    }

    public async Task<TableResponseDto> UpdateAsync(int id, UpdateTableDto dto, CancellationToken cancellationToken)
    {
        var table = await db.Tables.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Table not found.", StatusCodes.Status404NotFound);

        var name = dto.Name.Trim();
        if (await db.Tables.AnyAsync(x => x.Id != id && x.Name == name, cancellationToken))
        {
            throw new ApiException("A table with this name already exists.", StatusCodes.Status409Conflict);
        }

        await EnsureStatusChangeIsSafeAsync(table, dto.Status, cancellationToken);

        table.Name = name;
        table.Capacity = dto.Capacity;
        table.Status = dto.Status;
        await db.SaveChangesAsync(cancellationToken);
        return table.ToTableResponse();
    }

    public async Task<TableResponseDto> UpdateStatusAsync(int id, UpdateTableStatusDto dto, CancellationToken cancellationToken)
    {
        var table = await db.Tables.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Table not found.", StatusCodes.Status404NotFound);

        await EnsureStatusChangeIsSafeAsync(table, dto.Status, cancellationToken);

        table.Status = dto.Status;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Table {TableId} status updated to {Status}", table.Id, table.Status);
        return table.ToTableResponse();
    }

    private async Task EnsureStatusChangeIsSafeAsync(Table table, TableStatus requestedStatus, CancellationToken cancellationToken)
    {
        if (table.Status == requestedStatus)
        {
            return;
        }

        var hasActiveOrder = await db.OrderTables.AnyAsync(x =>
            x.TableId == table.Id &&
            (x.Order.Status == OrderStatus.InSalads || x.Order.Status == OrderStatus.InMain),
            cancellationToken);

        if (hasActiveOrder && requestedStatus != TableStatus.Occupied)
        {
            throw new ApiException("Table is assigned to an active order and cannot be marked available or reserved.", StatusCodes.Status409Conflict);
        }
    }
}
