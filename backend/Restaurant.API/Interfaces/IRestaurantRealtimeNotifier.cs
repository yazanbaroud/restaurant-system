using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IRestaurantRealtimeNotifier
{
    Task OrderCreatedAsync(OrderResponseDto order, int? customerUserId, CancellationToken cancellationToken);
    Task OrderUpdatedAsync(OrderResponseDto order, int? customerUserId, CancellationToken cancellationToken);
    Task OrderStatusUpdatedAsync(OrderResponseDto order, int? customerUserId, CancellationToken cancellationToken);
    Task PaymentAddedAsync(PaymentResponseDto payment, int? customerUserId, CancellationToken cancellationToken);
    Task ReservationCreatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken);
    Task ReservationStatusUpdatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken);
}
