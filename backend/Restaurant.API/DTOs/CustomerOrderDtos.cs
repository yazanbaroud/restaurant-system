using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreateCustomerOrderDto(
    OrderType OrderType,
    int? TableId,
    string? Notes,
    IReadOnlyCollection<CustomerOrderItemInputDto> Items);

public sealed record UpdateCustomerOrderDto(
    OrderType OrderType,
    int? TableId,
    string? Notes);

public sealed record CustomerOrderItemInputDto(int MenuItemId, int Quantity, string? Notes);
public sealed record UpdateCustomerOrderItemDto(int Quantity, string? Notes);
public sealed record CustomerTableOptionDto(int Id, string Name, int Capacity);
