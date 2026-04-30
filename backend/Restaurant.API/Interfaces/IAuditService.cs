using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public sealed record AuditLogEntry(
    string EntityType,
    int EntityId,
    string Action,
    int? PerformedByUserId = null,
    object? OldValues = null,
    object? NewValues = null);

public interface IAuditService
{
    Task TryLogAsync(AuditLogEntry entry, CancellationToken cancellationToken);

    Task<PagedAuditLogsResponseDto> GetAsync(
        string? entityType,
        int? userId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
}
