using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IDashboardService
{
    Task<AdminDashboardDto> GetAdminDashboardAsync(CancellationToken cancellationToken);
}
