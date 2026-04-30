using Microsoft.AspNetCore.SignalR;
using Restaurant.API.DTOs;
using Restaurant.API.Hubs;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Services;

public sealed class RestaurantRealtimeNotifier(IHubContext<RestaurantHub> hub) : IRestaurantRealtimeNotifier
{
    public Task OrderCreatedAsync(OrderResponseDto order, int? customerUserId, CancellationToken cancellationToken) =>
        SendOperationalAndCustomerAsync(RestaurantRealtimeEvents.OrderCreated, order, customerUserId, cancellationToken);

    public Task OrderUpdatedAsync(OrderResponseDto order, int? customerUserId, CancellationToken cancellationToken) =>
        SendOperationalAndCustomerAsync(RestaurantRealtimeEvents.OrderUpdated, order, customerUserId, cancellationToken);

    public Task OrderStatusUpdatedAsync(OrderResponseDto order, int? customerUserId, CancellationToken cancellationToken) =>
        SendOperationalAndCustomerAsync(RestaurantRealtimeEvents.OrderStatusUpdated, order, customerUserId, cancellationToken);

    public Task PaymentAddedAsync(CreatePaymentResponseDto payment, int? customerUserId, CancellationToken cancellationToken) =>
        SendOperationalAndCustomerAsync(RestaurantRealtimeEvents.PaymentAdded, payment, customerUserId, cancellationToken);

    public Task ReservationCreatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken) =>
        SendOperationalAsync(RestaurantRealtimeEvents.ReservationCreated, reservation, cancellationToken);

    public Task ReservationStatusUpdatedAsync(ReservationResponseDto reservation, CancellationToken cancellationToken) =>
        SendOperationalAsync(RestaurantRealtimeEvents.ReservationStatusUpdated, reservation, cancellationToken);

    private Task SendOperationalAsync(string eventName, object payload, CancellationToken cancellationToken) =>
        hub.Clients.Groups(RestaurantRealtimeGroups.Operational).SendAsync(eventName, payload, cancellationToken);

    private Task SendOperationalAndCustomerAsync(string eventName, object payload, int? customerUserId, CancellationToken cancellationToken)
    {
        if (customerUserId is null or <= 0)
        {
            return SendOperationalAsync(eventName, payload, cancellationToken);
        }

        var groups = RestaurantRealtimeGroups.Operational
            .Append(RestaurantRealtimeGroups.User(customerUserId.Value))
            .ToArray();

        return hub.Clients.Groups(groups).SendAsync(eventName, payload, cancellationToken);
    }
}
