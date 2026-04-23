using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreateOrderDto(
    int? UserId,
    string? CustomerFirstName,
    string? CustomerLastName,
    string? Notes,
    OrderType OrderType,
    IReadOnlyCollection<int>? TableIds,
    IReadOnlyCollection<CreateOrderItemDto> Items);

public sealed record CreateOrderItemDto(int MenuItemId, int Quantity, string? Notes);
public sealed record AddOrderItemDto(int MenuItemId, int Quantity, string? Notes);
public sealed record UpdateOrderDto(string? CustomerFirstName, string? CustomerLastName, string? Notes, OrderType OrderType);
public sealed record UpdateOrderStatusDto(OrderStatus Status);
public sealed record UpdateOrderTablesDto(IReadOnlyCollection<int> TableIds);
public sealed record UpdateOrderItemDto(int Quantity, string? Notes);
public sealed record OrderItemResponseDto(int Id, int MenuItemId, string MenuItemName, int Quantity, decimal UnitPrice, decimal LineTotal, string? Notes);
public sealed record OrderTableResponseDto(int Id, int TableId, string TableName);
public sealed record OrderResponseDto(
    int Id,
    Guid UniqueIdentifier,
    string OrderNumber,
    int? UserId,
    string CustomerFirstName,
    string CustomerLastName,
    DateTime CreatedAt,
    OrderStatus Status,
    string? Notes,
    decimal TotalPrice,
    OrderType OrderType,
    PaymentStatus PaymentStatus,
    IReadOnlyCollection<OrderItemResponseDto> Items,
    IReadOnlyCollection<OrderTableResponseDto> Tables);
