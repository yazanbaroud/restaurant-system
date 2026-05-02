using Microsoft.AspNetCore.SignalR;
using Restaurant.API.DTOs;
using Restaurant.API.Hubs;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Services;

public sealed class RestaurantRealtimeNotifier(IHubContext<RestaurantHub> hub) : IRestaurantRealtimeNotifier
{
    public Task OrderCreatedAsync(OrderResponseDto order, CancellationToken cancellationToken) =>
        SendOrderAsync(RestaurantRealtimeEvents.OrderCreated, order, cancellationToken);

    public Task OrderUpdatedAsync(OrderResponseDto order, CancellationToken cancellationToken) =>
        SendOrderAsync(RestaurantRealtimeEvents.OrderUpdated, order, cancellationToken);

    public Task OrderStatusUpdatedAsync(OrderResponseDto order, CancellationToken cancellationToken) =>
        SendOrderAsync(RestaurantRealtimeEvents.OrderStatusUpdated, order, cancellationToken);

    public Task PaymentAddedAsync(CreatePaymentResponseDto payment, CancellationToken cancellationToken) =>
        SendOperationalAsync(RestaurantRealtimeEvents.PaymentAdded, payment, cancellationToken);

    public Task ReservationCreatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken) =>
        SendOperationalAsync(RestaurantRealtimeEvents.ReservationCreated, reservation, cancellationToken);

    public Task ReservationStatusUpdatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken) =>
        SendOperationalAsync(RestaurantRealtimeEvents.ReservationStatusUpdated, reservation, cancellationToken);

    private Task SendOperationalAsync(string eventName, object payload, CancellationToken cancellationToken) =>
        hub.Clients.Groups(RestaurantRealtimeGroups.Operational).SendAsync(eventName, payload, cancellationToken);

    private Task SendOrderAsync(string eventName, object payload, CancellationToken cancellationToken) =>
        hub.Clients.Groups(RestaurantRealtimeGroups.OrderObservers).SendAsync(eventName, payload, cancellationToken);
}
