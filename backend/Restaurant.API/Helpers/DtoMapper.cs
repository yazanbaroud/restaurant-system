using Restaurant.API.DTOs;
using Restaurant.API.Models;

namespace Restaurant.API.Helpers;

public static class DtoMapper
{
    public static UserResponseDto ToUserResponse(this User user) =>
        new(user.Id, user.FirstName, user.LastName, user.Email, user.PhoneNumber, user.Role, user.IsActive);

    public static CurrentUserDto ToCurrentUser(this User user) =>
        new(user.Id, user.FirstName, user.LastName, user.Email, user.PhoneNumber, user.Role, user.IsActive);

    public static MenuItemResponseDto ToMenuItemResponse(this MenuItem item) =>
        item.ToMenuItemResponse(null);

    public static MenuItemResponseDto ToMenuItemResponse(this MenuItem item, string? categoryName) =>
        new(
            item.Id,
            item.Name,
            item.Description,
            item.Price,
            item.Category,
            categoryName ?? string.Empty,
            item.IsAvailable,
            item.Images.Select(x => new MenuItemImageResponseDto(x.Id, x.MenuItemId, x.ImageUrl, x.IsMainImage)).ToArray());

    public static MenuCategoryResponseDto ToMenuCategoryResponse(this MenuCategoryRecord category) =>
        new(category.Id, category.Name, category.IsActive, category.SortOrder);

    public static BusinessHourResponseDto ToBusinessHourResponse(this RestaurantBusinessHour businessHour) =>
        new(businessHour.Id, businessHour.DayOfWeek, businessHour.IsOpen, businessHour.OpenTime, businessHour.CloseTime);

    public static TableResponseDto ToTableResponse(this Table table) =>
        new(table.Id, table.Name, table.Capacity, table.Status, table.Location, table.Notes);

    public static OrderResponseDto ToOrderResponse(this Order order) =>
        new(
            order.Id,
            order.UniqueIdentifier,
            order.OrderNumber,
            order.UserId,
            order.CustomerFirstName,
            order.CustomerLastName,
            AsUtc(order.CreatedAt),
            order.Status,
            order.KitchenStatus,
            order.Notes,
            order.TotalAmount,
            order.OrderType,
            order.PaymentStatus,
            order.Items.Select(x => new OrderItemResponseDto(
                x.Id,
                x.MenuItemId,
                x.MenuItem.Name,
                x.Quantity,
                x.UnitPrice,
                x.UnitPrice * x.Quantity,
                x.Status,
                x.Notes)).ToArray(),
            order.OrderTables.Select(x => new OrderTableResponseDto(x.Id, x.TableId, x.Table.Name)).ToArray(),
            order.StatusChanges
                .OrderByDescending(x => x.ChangedAt)
                .Select(x => new OrderStatusChangeResponseDto(
                    x.Id,
                    x.ChangeType,
                    x.FromValue,
                    x.ToValue,
                    AsUtc(x.ChangedAt),
                    x.ChangedByUserId))
                .ToArray());

    public static PaymentResponseDto ToPaymentResponse(this Payment payment) =>
        new(
            payment.Id,
            payment.OrderId,
            payment.IdempotencyKey,
            payment.Amount,
            payment.Method,
            AsUtc(payment.CreatedAt),
            payment.CreatedByUserId,
            payment.Note,
            AsUtc(payment.CreatedAt),
            payment.CreatedByUserId);

    public static PaymentRefundResponseDto ToPaymentRefundResponse(this PaymentRefund refund) =>
        new(
            refund.Id,
            refund.OrderId,
            refund.IdempotencyKey,
            refund.Amount,
            refund.Method,
            refund.Reason,
            AsUtc(refund.RefundedAt),
            refund.PerformedByUserId);

    public static ReservationResponseDto ToReservationResponse(this Reservation reservation) =>
        new(
            reservation.Id,
            reservation.FirstName,
            reservation.LastName,
            reservation.PhoneNumber,
            reservation.ReservationDate,
            reservation.ReservationTime,
            reservation.DurationMinutes,
            reservation.GuestsCount,
            reservation.TableId,
            reservation.Table?.Name,
            reservation.CustomerNotes,
            reservation.RestaurantNotes,
            reservation.Status,
            AsUtc(reservation.CreatedAt));

    private static DateTime AsUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
