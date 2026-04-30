namespace Restaurant.API.DTOs;

public sealed record AuditLogResponseDto(
    long Id,
    string EntityType,
    int EntityId,
    string Action,
    int? PerformedByUserId,
    DateTime Timestamp,
    string? OldValues,
    string? NewValues);

public sealed record PagedAuditLogsResponseDto(
    int Page,
    int PageSize,
    int TotalCount,
    IReadOnlyCollection<AuditLogResponseDto> Items);
