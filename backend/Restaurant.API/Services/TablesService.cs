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

public sealed class TablesService(
    AppDbContext db,
    IOrderTableAssignmentService tableAssignments,
    ILogger<TablesService> logger) : ITablesService
{
    public async Task<IReadOnlyCollection<TableResponseDto>> GetAllAsync(CancellationToken cancellationToken) =>
        await db.Tables.AsNoTracking().OrderBy(x => x.Name).Select(x => x.ToTableResponse()).ToArrayAsync(cancellationToken);

    public async Task<TableResponseDto> CreateAsync(CreateTableDto dto, CancellationToken cancellationToken)
    {
        var name = dto.Name.Trim();
        if (await db.Tables.AnyAsync(x => x.Name == name, cancellationToken))
        {
            throw new ApiException("Table name already exists.", StatusCodes.Status409Conflict);
        }

        var table = new Table
        {
            Name = name,
            Capacity = dto.Capacity,
            Status = TableStatus.Available,
            Location = TrimOptional(dto.Location),
            Notes = TrimOptional(dto.Notes)
        };
        db.Tables.Add(table);
        await db.SaveChangesAsync(cancellationToken);
        return table.ToTableResponse();
    }

    public async Task<TableResponseDto> UpdateAsync(int id, UpdateTableDto dto, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var table = await tableAssignments.LoadTableForUpdateAsync(id, cancellationToken);
            var name = dto.Name.Trim();
            if (await db.Tables.AnyAsync(x => x.Id != id && x.Name == name, cancellationToken))
            {
                throw new ApiException("Table name already exists.", StatusCodes.Status409Conflict);
            }

            await tableAssignments.EnsureManualStatusChangeIsSafeAsync(table, dto.Status, cancellationToken);

            table.Name = name;
            table.Capacity = dto.Capacity;
            table.Status = dto.Status;
            table.Location = TrimOptional(dto.Location);
            table.Notes = TrimOptional(dto.Notes);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return table.ToTableResponse();
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Table {TableId} update concurrency conflict", id);
            throw new ApiException("Table was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Table {TableId} update SQL concurrency conflict", id);
            throw new ApiException("Table was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
        }
    }

    public async Task<TableResponseDto> UpdateStatusAsync(int id, UpdateTableStatusDto dto, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var table = await tableAssignments.LoadTableForUpdateAsync(id, cancellationToken);
            await tableAssignments.EnsureManualStatusChangeIsSafeAsync(table, dto.Status, cancellationToken);

            table.Status = dto.Status;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            logger.LogInformation("Table {TableId} status updated to {Status}", table.Id, table.Status);
            return table.ToTableResponse();
        }
        catch (DbUpdateConcurrencyException exception)
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Table {TableId} status update concurrency conflict", id);
            throw new ApiException("Table was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsSqlConcurrencyFailure(exception))
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            logger.LogWarning(exception, "Table {TableId} status update SQL concurrency conflict", id);
            throw new ApiException("Table was updated concurrently. Refresh and try again.", StatusCodes.Status409Conflict);
        }
        catch
        {
            await RollbackQuietlyAsync(transaction, cancellationToken);
            throw;
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
            logger.LogWarning(exception, "Failed to roll back table transaction");
        }
    }

    private static string? TrimOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool IsSqlConcurrencyFailure(DbUpdateException exception) =>
        exception.InnerException is SqlException sqlException &&
        sqlException.Errors.Cast<SqlError>().Any(error => error.Number == 1205);
}
