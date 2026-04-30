namespace Restaurant.API.Models;

public sealed class AuditLog
{
    public long Id { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public int EntityId { get; set; }
    public string Action { get; set; } = string.Empty;
    public int? PerformedByUserId { get; set; }
    public User? PerformedByUser { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
}
