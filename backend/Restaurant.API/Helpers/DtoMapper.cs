using Restaurant.API.DTOs;
using Restaurant.API.Models;

namespace Restaurant.API.Helpers;

public static class DtoMapper
{
    public static UserResponseDto ToUserResponse(this User user) =>
        new(user.Id, user.FirstName, user.LastName, user.Email, user.PhoneNumber, user.Role);

    public static CurrentUserDto ToCurrentUser(this User user) =>
        new(user.Id, user.FirstName, user.LastName, user.Email, user.PhoneNumber, user.Role);

    public static MenuItemResponseDto ToMenuItemResponse(this MenuItem item) =>
        new(
            item.Id,
            item.Name,
            item.Description,
            item.Price,
            item.Category,
            item.IsAvailable,
            item.Images.Select(x => new MenuItemImageResponseDto(x.Id, x.MenuItemId, x.ImageUrl, x.IsMainImage)).ToArray());

    public static TableResponseDto ToTableResponse(this Table table) =>
        new(table.Id, table.Name, table.Capacity, table.Status);

    public static OrderResponseDto ToOrderResponse(this Order order) =>
        new(
            order.Id,
            order.UniqueIdentifier,
            order.OrderNumber,
            order.UserId,
            order.CustomerFirstName,
            order.CustomerLastName,
            order.CreatedAt,
            order.Status,
            order.Notes,
            order.TotalPrice,
            order.OrderType,
            order.PaymentStatus,
            order.Items.Select(x => new OrderItemResponseDto(
                x.Id,
                x.MenuItemId,
                x.MenuItem.Name,
                x.Quantity,
                x.UnitPrice,
                x.UnitPrice * x.Quantity,
                x.Notes)).ToArray(),
            order.OrderTables.Select(x => new OrderTableResponseDto(x.Id, x.TableId, x.Table.Name)).ToArray());

    public static PaymentResponseDto ToPaymentResponse(this Payment payment) =>
        new(payment.Id, payment.OrderId, payment.Amount, payment.Method, payment.PaidAt);

    public static ReservationResponseDto ToReservationResponse(this Reservation reservation) =>
        new(
            reservation.Id,
            reservation.FirstName,
            reservation.LastName,
            reservation.PhoneNumber,
            reservation.ReservationDate,
            reservation.ReservationTime,
            reservation.GuestsCount,
            reservation.CustomerNotes,
            reservation.RestaurantNotes,
            reservation.Status,
            reservation.CreatedAt);
}
