using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreateOrderDto(
    string? CustomerFirstName,
    string? CustomerLastName,
    string? Notes,
    OrderType OrderType,
    IReadOnlyCollection<int>? TableIds,
    IReadOnlyCollection<CreateOrderItemDto> Items);

public sealed record CreateOrderItemDto(int MenuItemId, int Quantity, string? Notes);
public sealed record AddOrderItemDto(int MenuItemId, int Quantity, string? Notes);
public sealed record UpdateOrderDto(string? CustomerFirstName, string? CustomerLastName, string? Notes, OrderType OrderType);
public sealed record UpdateOrderTablesDto(IReadOnlyCollection<int> TableIds);
public sealed record UpdateOrderItemDto(int Quantity, string? Notes);
public sealed record UpdateOrderItemStatusDto(OrderItemStatus Status);
public sealed record OrderItemResponseDto(int Id, int MenuItemId, string MenuItemName, int Quantity, decimal UnitPrice, decimal LineTotal, OrderItemStatus Status, string? Notes);
public sealed record OrderTableResponseDto(int Id, int TableId, string TableName);
public sealed record OrderStatusChangeResponseDto(
    int Id,
    OrderStatusChangeType ChangeType,
    string? FromValue,
    string ToValue,
    DateTime ChangedAt,
    int ChangedByUserId);

public sealed record OrderResponseDto(
    int Id,
    Guid UniqueIdentifier,
    string OrderNumber,
    int? UserId,
    string CustomerFirstName,
    string CustomerLastName,
    DateTime CreatedAt,
    OrderStatus Status,
    KitchenStatus KitchenStatus,
    string? Notes,
    decimal TotalPrice,
    OrderType OrderType,
    PaymentStatus PaymentStatus,
    IReadOnlyCollection<OrderItemResponseDto> Items,
    IReadOnlyCollection<OrderTableResponseDto> Tables,
    IReadOnlyCollection<OrderStatusChangeResponseDto> StatusChanges);

public sealed record PagedResponseDto<T>(int Page, int PageSize, int TotalCount, IReadOnlyCollection<T> Items);
