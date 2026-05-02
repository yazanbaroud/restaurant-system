# Backend Manual QA Checklist

Use this checklist before demo or release against a temporary/local database with separate Admin, Waiter, Kitchen, and Salad staff accounts.

## Automated Test Status

- Backend integration tests are configured in `backend/Restaurant.API.Tests`.
- Latest local refactor validation should include `dotnet build RestaurantSystem.sln` and `dotnet test RestaurantSystem.sln`.
- Browser end-to-end checks are still recommended because the automated tests do not cover every UI workflow.

## Authentication and Authorization

- `POST /api/Auth/register` returns `404`; public self-registration is removed.
- `POST /api/Auth/login` works for active Admin, Waiter, Kitchen, and Salad users.
- Login rejects inactive users.
- Login rejects any non-staff or unknown role if one exists in the database.
- `GET /api/Auth/me`, profile update, password change, refresh, and logout work for authenticated staff.
- Guest calls to staff endpoints return `401`.
- Waiter, Kitchen, and Salad calls to admin-only endpoints return `403`.
- Kitchen cannot call waiter/admin order management endpoints that are not part of the kitchen queue.
- Salad cannot call waiter/admin order management endpoints that are not part of the salad queue.
- Admin and Waiter can still use their permitted operational endpoints.
- SignalR `/hubs/restaurant` rejects unauthenticated connections.
- SignalR operational events are sent to staff role groups, not public/global clients.

## Staff Orders

- Admin and Waiter can create takeaway orders.
- Admin and Waiter can create dine-in orders with valid available tables.
- Dine-in order creation rejects missing, occupied, or invalid tables.
- Order creation ignores client-supplied user id, prices, totals, order status, and payment status.
- Order creation calculates totals from current menu prices.
- Staff cannot order unavailable menu items.
- Staff cannot order menu items whose category is inactive.
- Empty items, missing menu item, and quantity below 1 return validation errors.
- Staff cannot edit items, tables, or details after the order is paid, cancelled, completed, or has any payment.
- Cancelled orders cannot be reopened.
- Completed orders cannot be reopened.
- Orders with any payment cannot be cancelled.

## Kitchen and Salad Queues

- Kitchen users can view kitchen queue data.
- Salad users can view salad queue data.
- Kitchen status updates are allowed only through the expected production flow.
- Salad status updates are allowed only through the expected production flow.
- Kitchen and Salad users cannot create orders or add payments.
- Admin/Waiter operational screens receive order status changes after kitchen/salad updates.

## Payments

- Admin and Waiter can create payments.
- Payment on a cancelled order is blocked.
- Payment on a completed order is allowed only when the order is not fully paid.
- Partial payments remain supported.
- Overpayment is blocked.
- Payment status is recalculated from server-side payment totals.
- Payment creation ignores client-side totals.
- Duplicate idempotency keys replay the same payment only when payloads match.
- Duplicate idempotency keys with changed payloads return conflict.

## Reservations

- `POST /api/Reservations` works without login.
- Guest-created reservations remain anonymous with `UserId = null`.
- Public reservation creation is blocked when the selected date is in the past.
- Public reservation creation is blocked when the selected day is closed in business hours.
- Public reservation creation is blocked when the selected time is before opening or after closing.
- Public reservation creation succeeds when the selected time is inside configured business hours.
- Admin/Waiter reservation list and filters work.
- Admin reservation approval, rejection, arrival, no-show, cancellation, and delete-as-cancel flows remain unchanged.
- Waiter reservation visibility remains available for operational awareness.

## Business Hours

- Anonymous users can read `GET /api/business-hours`.
- Admin can read and bulk update `GET /api/admin/business-hours` and `PUT /api/admin/business-hours`.
- Non-admin users cannot update business hours.
- Bulk update requires exactly seven unique days, Sunday through Saturday.
- Open days require both open and close times.
- Open time must be before close time.
- Startup seeds all seven days as open from `10:00` to `23:00` when no business-hour rows exist.
- Closing today in Admin business hours immediately causes public reservation creation for today to fail with a clear Hebrew validation message.
- Restoring today to open hours allows public reservation creation inside the configured range again.

## Table Data

- Table create accepts optional `Location` and `Notes`.
- Table update trims `Location` and `Notes`.
- Empty or whitespace-only `Location` and `Notes` are stored as `null`.
- `Location` rejects values longer than 100 characters.
- `Notes` rejects values longer than 500 characters.
- Table responses include `Location` and `Notes`.

## Database and Migrations

- `dotnet build RestaurantSystem.sln` succeeds with all migration files compiled.
- `AppDbContextModelSnapshot` includes `BusinessHours` with a unique `DayOfWeek` index and nullable `OpenTime` / `CloseTime` `time` columns.
- `AppDbContextModelSnapshot` includes nullable table `Location` max length 100 and `Notes` max length 500.
- `AddBusinessHours.Up()` creates `BusinessHours`, adds the unique day index, and inserts default rows for all seven days.
- `AddBusinessHours.Down()` drops `BusinessHours`.
- Fresh database creation from migrations should be verified against a temporary database before deployment.

## Frontend Browser QA

- Guest menu page loads and renders the current menu without cart controls.
- Guest dish detail page loads without cart controls.
- Guest public reservation form loads and can submit a valid in-hours reservation.
- `/register`, `/cart`, `/orders`, and account-based `/reservations` routes do not exist as customer flows.
- Waiter browser QA: active tables/orders, create order, order details, status updates, add payment, waiter reservations, realtime notices.
- Kitchen browser QA: kitchen queue, allowed status updates, forbidden staff-management/order-payment routes.
- Salad browser QA: salad queue, allowed status updates, forbidden staff-management/order-payment routes.
- Admin browser QA: dashboard, reports, menu/categories, tables/location/notes, users, orders/payments, reservations, business hours, realtime notices.
- Run a two-session realtime check for order, payment, and reservation updates.

## Build Checks

- Run `dotnet build RestaurantSystem.sln`.
- Run `dotnet test RestaurantSystem.sln`.
- Run `npm.cmd run build` from `frontend`.
- Verify Swagger starts and protected endpoints still show authorization requirements.
