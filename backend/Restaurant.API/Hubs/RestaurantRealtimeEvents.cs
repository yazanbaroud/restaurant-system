namespace Restaurant.API.Hubs;

public static class RestaurantRealtimeEvents
{
    public const string OrderCreated = "orderCreated";
    public const string OrderUpdated = "orderUpdated";
    public const string OrderStatusUpdated = "orderStatusUpdated";
    public const string PaymentAdded = "paymentAdded";
    public const string ReservationCreated = "reservationCreated";
    public const string ReservationStatusUpdated = "reservationStatusUpdated";
}
