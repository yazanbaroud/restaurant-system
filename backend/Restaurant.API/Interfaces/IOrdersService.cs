using Restaurant.API.DTOs;
using Restaurant.API.Enums;

namespace Restaurant.API.Interfaces;

public interface IOrdersService
{
    Task<OrderResponseDto> CreateAsync(CreateOrderDto dto, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<OrderResponseDto>> GetAllAsync(OrderStatus? status, DateOnly? date, DateOnly? from, DateOnly? to, PaymentStatus? paymentStatus, OrderType? orderType, bool activeOnly, CancellationToken cancellationToken);
    Task<OrderResponseDto> GetByIdAsync(int id, bool activeOnly, CancellationToken cancellationToken);
    Task<OrderResponseDto> UpdateAsync(int id, UpdateOrderDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> UpdateStatusAsync(int id, UpdateOrderStatusDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> AddItemAsync(int id, AddOrderItemDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> UpdateItemAsync(int id, int itemId, UpdateOrderItemDto dto, CancellationToken cancellationToken);
    Task<OrderResponseDto> DeleteItemAsync(int id, int itemId, CancellationToken cancellationToken);
    Task<OrderResponseDto> UpdateTablesAsync(int id, UpdateOrderTablesDto dto, CancellationToken cancellationToken);
}
