using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class TablesService(AppDbContext db) : ITablesService
{
    public async Task<IReadOnlyCollection<TableResponseDto>> GetAllAsync(CancellationToken cancellationToken) =>
        await db.Tables.AsNoTracking().OrderBy(x => x.Name).Select(x => x.ToTableResponse()).ToArrayAsync(cancellationToken);

    public async Task<TableResponseDto> CreateAsync(CreateTableDto dto, CancellationToken cancellationToken)
    {
        if (await db.Tables.AnyAsync(x => x.Name == dto.Name, cancellationToken))
        {
            throw new ApiException("A table with this name already exists.", StatusCodes.Status409Conflict);
        }

        var table = new Table { Name = dto.Name.Trim(), Capacity = dto.Capacity, Status = dto.Status };
        db.Tables.Add(table);
        await db.SaveChangesAsync(cancellationToken);
        return table.ToTableResponse();
    }

    public async Task<TableResponseDto> UpdateAsync(int id, UpdateTableDto dto, CancellationToken cancellationToken)
    {
        var table = await db.Tables.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Table not found.", StatusCodes.Status404NotFound);

        table.Name = dto.Name.Trim();
        table.Capacity = dto.Capacity;
        table.Status = dto.Status;
        await db.SaveChangesAsync(cancellationToken);
        return table.ToTableResponse();
    }

    public async Task<TableResponseDto> UpdateStatusAsync(int id, UpdateTableStatusDto dto, CancellationToken cancellationToken)
    {
        var table = await db.Tables.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Table not found.", StatusCodes.Status404NotFound);
        table.Status = dto.Status;
        await db.SaveChangesAsync(cancellationToken);
        return table.ToTableResponse();
    }
}
