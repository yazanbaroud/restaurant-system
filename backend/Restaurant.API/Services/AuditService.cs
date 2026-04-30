using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class AuditService(
    AppDbContext db,
    IHttpContextAccessor httpContextAccessor,
    ILogger<AuditService> logger) : IAuditService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task TryLogAsync(AuditLogEntry entry, CancellationToken cancellationToken)
    {
        AuditLog? auditLog = null;
        try
        {
            if (string.IsNullOrWhiteSpace(entry.EntityType) || string.IsNullOrWhiteSpace(entry.Action))
            {
                logger.LogWarning("Skipped audit log with missing entity type or action");
                return;
            }

            auditLog = new AuditLog
            {
                EntityType = entry.EntityType,
                EntityId = entry.EntityId,
                Action = entry.Action,
                PerformedByUserId = entry.PerformedByUserId ?? CurrentUserId(),
                Timestamp = DateTime.UtcNow,
                OldValues = Serialize(entry.OldValues),
                NewValues = Serialize(entry.NewValues)
            };

            db.AuditLogs.Add(auditLog);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            if (auditLog is not null)
            {
                db.Entry(auditLog).State = EntityState.Detached;
            }

            logger.LogError(
                exception,
                "Failed to write audit log for {EntityType} {EntityId} action {Action}",
                entry.EntityType,
                entry.EntityId,
                entry.Action);
        }
    }

    public async Task<PagedAuditLogsResponseDto> GetAsync(
        string? entityType,
        int? userId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            var normalizedEntityType = entityType.Trim();
            query = query.Where(x => x.EntityType == normalizedEntityType);
        }

        if (userId.HasValue)
        {
            query = query.Where(x => x.PerformedByUserId == userId.Value);
        }

        if (from.HasValue)
        {
            var fromUtc = from.Value.UtcDateTime;
            query = query.Where(x => x.Timestamp >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = to.Value.UtcDateTime;
            query = query.Where(x => x.Timestamp <= toUtc);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(x => x.Timestamp)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditLogResponseDto(
                x.Id,
                x.EntityType,
                x.EntityId,
                x.Action,
                x.PerformedByUserId,
                x.Timestamp,
                x.OldValues,
                x.NewValues))
            .ToArrayAsync(cancellationToken);

        return new PagedAuditLogsResponseDto(page, pageSize, totalCount, items);
    }

    private int? CurrentUserId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var userId = user.GetUserId();
        return userId > 0 ? userId : null;
    }

    private static string? Serialize(object? value) =>
        value is null ? null : JsonSerializer.Serialize(value, JsonOptions);
}
