using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Restaurant.API.Helpers;

namespace Restaurant.API.Hubs;

[Authorize]
public sealed class RestaurantHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (user is not null)
        {
            if (user.IsInRole(AppRoles.Admin))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, RestaurantRealtimeGroups.Admin);
            }

            if (user.IsInRole(AppRoles.Waiter))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, RestaurantRealtimeGroups.Waiter);
            }

            if (user.IsInRole(AppRoles.Kitchen))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, RestaurantRealtimeGroups.Kitchen);
            }

            if (user.IsInRole(AppRoles.Salad))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, RestaurantRealtimeGroups.Salad);
            }

        }

        await base.OnConnectedAsync();
    }
}
