# Backend Manual QA Checklist

Use this checklist before demo or release when automated backend tests are not available.

## Authentication and Authorization

- Guest calls to `/api/customer/orders` return `401`.
- Guest calls to `/api/customer/reservations` return `401`.
- Customer calls to admin endpoints return `403`.
- Customer calls to waiter/admin payment endpoints return `403`.
- Waiter calls to admin-only endpoints return `403`.
- Admin and Waiter can still use their permitted operational endpoints.
- SignalR `/hubs/restaurant` rejects unauthenticated connections.
- SignalR events are not broadcast through `Clients.All`; operational events go to Admin/Waiter groups and customer order events go only to `user:{id}`.

## Customer Orders

- Customer can list only their own orders through `GET /api/customer/orders`.
- Customer gets `404` when requesting another customer's order by id.
- Customer order creation ignores client-supplied user id, prices, totals, order status, and payment status.
- Customer order creation calculates totals from current menu prices.
- Customer cannot order unavailable menu items.
- Customer cannot order menu items whose category is inactive.
- Dine-in customer order requires a valid available table.
- Take-away customer order does not require a table.
- Empty items, missing menu item, and quantity below 1 return validation errors.

## Order Mutation Rules

- Customer cannot edit an order after it is paid.
- Customer cannot edit an order after it is cancelled.
- Customer cannot edit an order after it is completed.
- Customer cannot edit an order after any payment exists.
- Staff cannot edit items, tables, or details after the order is paid, cancelled, completed, or has any payment.
- Cancelled orders cannot be reopened.
- Completed orders cannot be reopened.
- Orders with any payment cannot be cancelled.
- Staff cannot add menu items from inactive categories.

## Payments

- Payment on a cancelled order is blocked.
- Payment on a completed order is allowed only when the order is not fully paid.
- Partial payments remain supported.
- Overpayment is blocked.
- Payment status is recalculated from server-side payment totals.
- Payment creation ignores client-side totals.

## Reservations

- Guest-created reservations remain anonymous with `UserId = null`.
- Authenticated Customer public reservation creation links the reservation to the JWT user id.
- Customer can list only reservations owned by their user id.
- Customer gets `404` for another user's reservation.
- Customer can cancel only `Pending` or `Approved` reservations.
- Customer cancel is blocked for `Cancelled`, `Rejected`, `Arrived`, and `NoShow`.
- Admin/Waiter reservation approval, rejection, arrival, no-show, and cancellation flows remain unchanged.

## Table Data

- Table create accepts optional `Location` and `Notes`.
- Table update trims `Location` and `Notes`.
- Empty or whitespace-only `Location` and `Notes` are stored as `null`.
- `Location` rejects values longer than 100 characters.
- `Notes` rejects values longer than 500 characters.
- Table responses include `Location` and `Notes`.

## Build Checks

- Run `dotnet build backend\Restaurant.API\Restaurant.API.csproj -c Release`.
- Run the frontend production build after frontend/API contract changes.
- Verify Swagger starts and protected endpoints still show authorization requirements.
