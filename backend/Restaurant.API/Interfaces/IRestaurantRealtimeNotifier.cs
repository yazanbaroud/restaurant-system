using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IRestaurantRealtimeNotifier
{
    Task OrderCreatedAsync(OrderResponseDto order, CancellationToken cancellationToken);
    Task OrderUpdatedAsync(OrderResponseDto order, CancellationToken cancellationToken);
    Task OrderStatusUpdatedAsync(OrderResponseDto order, CancellationToken cancellationToken);
    Task PaymentAddedAsync(CreatePaymentResponseDto payment, CancellationToken cancellationToken);
    Task ReservationCreatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken);
    Task ReservationStatusUpdatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken);
}
