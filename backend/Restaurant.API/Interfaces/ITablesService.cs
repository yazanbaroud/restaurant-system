using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface ITablesService
{
    Task<IReadOnlyCollection<TableResponseDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<TableResponseDto> CreateAsync(CreateTableDto dto, CancellationToken cancellationToken);
    Task<TableResponseDto> UpdateAsync(int id, UpdateTableDto dto, CancellationToken cancellationToken);
    Task<TableResponseDto> UpdateStatusAsync(int id, UpdateTableStatusDto dto, CancellationToken cancellationToken);
}
