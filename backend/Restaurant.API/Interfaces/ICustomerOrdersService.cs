using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface ICustomerOrdersService
{
    Task<IReadOnlyCollection<OrderResponseDto>> GetAllAsync(int userId, CancellationToken cancellationToken);
    Task<OrderResponseDto> GetByIdAsync(int userId, int id, CancellationToken cancellationToken);
    Task<OrderResponseDto> CreateAsync(int userId, CreateCustomerOrderDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> UpdateAsync(int userId, int id, UpdateCustomerOrderDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> AddItemAsync(int userId, int id, CustomerOrderItemInputDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> UpdateItemAsync(int userId, int id, int itemId, UpdateCustomerOrderItemDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> DeleteItemAsync(int userId, int id, int itemId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<CustomerTableOptionDto>> GetAvailableTablesAsync(CancellationToken cancellationToken);
}
