# Backend Manual QA Checklist

Use this checklist before demo or release when automated backend tests are not available.

## Automated Test Status

- No backend test project is currently configured.
- Adding integration tests is recommended after deployment hardening, but was deferred here to avoid introducing a new database/test-host architecture during the final stabilization pass.
- Until automated tests exist, run the critical manual cases below against a temporary/local database with separate Admin, Waiter, and at least two Customer accounts.

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
- Customer gets `404` when updating or deleting an item on another customer's order.
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
- Customer role cannot call staff payment endpoints.

## Reservations

- Guest-created reservations remain anonymous with `UserId = null`.
- Authenticated Customer public reservation creation links the reservation to the JWT user id.
- Customer can list only reservations owned by their user id.
- Customer gets `404` for another user's reservation.
- Customer can cancel only `Pending` or `Approved` reservations.
- Customer cancel is blocked for `Cancelled`, `Rejected`, `Arrived`, and `NoShow`.
- Admin/Waiter reservation approval, rejection, arrival, no-show, and cancellation flows remain unchanged.
- Reservation creation is blocked when the selected date is in the past.
- Reservation creation is blocked when the selected day is closed in business hours.
- Reservation creation is blocked when the selected time is before opening or after closing.
- Reservation creation succeeds when the selected time is inside the configured business hours.

## Business Hours

- Anonymous users can read `GET /api/business-hours`.
- Admin can read and bulk update `GET /api/admin/business-hours` and `PUT /api/admin/business-hours`.
- Non-admin users cannot update business hours.
- Bulk update requires exactly seven unique days, Sunday through Saturday.
- Open days require both open and close times.
- Open time must be before close time.
- Startup seeds all seven days as open from `10:00` to `23:00` when no business-hour rows exist.
- Business-hours seeding still runs when an admin user already exists.
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

- `dotnet build backend\Restaurant.API\Restaurant.API.csproj -c Release` succeeds with all migration files compiled.
- `AppDbContextModelSnapshot` includes `BusinessHours` with a unique `DayOfWeek` index and nullable `OpenTime` / `CloseTime` `time` columns.
- `AppDbContextModelSnapshot` includes nullable table `Location` max length 100 and `Notes` max length 500.
- `AddBusinessHours.Up()` creates `BusinessHours`, adds the unique day index, and inserts default rows for all seven days.
- `AddBusinessHours.Down()` drops `BusinessHours`.
- `AddReservationUserOwnership` preserves existing anonymous reservations by keeping `Reservation.UserId` nullable.
- Fresh database creation from migrations should be verified against a temporary database before deployment.
- Existing production data must not be deleted during migration verification.

## Final Migration Readiness Notes

Last local verification pass: 2026-04-29.

Verified:

- Release backend build succeeded, proving all migration files compile.
- Migration list is linear and ordered:
  - `20260423220135_InitialCreate`
  - `20260425183000_MenuCategoriesAndAccountSecurity`
  - `20260428212500_AddTableLocationAndNotes`
  - `20260428224500_AddReservationUserOwnership`
  - `20260429010000_AddBusinessHours`
- `AppDbContextModelSnapshot` contains:
  - `BusinessHours` table with unique `DayOfWeek`.
  - nullable `Reservation.UserId` with `DeleteBehavior.SetNull`.
  - nullable table `Location` max length 100.
  - nullable table `Notes` max length 500.
- Startup seeding code calls business-hours seeding before the early return for an existing admin user.

Not fully verified in this local environment:

- A complete fresh LocalDB migration run could not be confirmed here because `dotnet-ef` is not installed and the local SQL client failed to open the automatic LocalDB instance.

Required before production deployment:

- Run a fresh migration against a disposable staging database.
- Confirm `__EFMigrationsHistory` contains all migrations above.
- Confirm `BusinessHours` contains seven default rows after startup.
- Confirm the seed admin is created only when no admin exists.
- Run the reservation business-hours checks in this file against the staging database.

## Final Manual QA Results

Last closure pass: 2026-04-29.

Verified in the in-app browser against the local running app:

- Guest menu page loads and renders the current menu.
- Guest add-to-cart action redirects to login with `returnUrl=/menu`.
- Guest direct `/cart` access redirects to login with `returnUrl=/cart`.
- Public reservation form loads with today's date and visible business-hours guidance.
- Public reservation success flow now works after fixing the frontend service to stop refetching the created reservation through the protected admin reservation endpoint.

Verified through direct local API calls:

- `GET /api/business-hours` returns `200` anonymously with seven seeded days.
- `GET /api/customer/orders` without a JWT returns `401`.
- `GET /api/customer/reservations` without a JWT returns `401`.
- `POST /api/Reservations` outside configured business hours returns `400` with the Hebrew message `המסעדה סגורה בשעה שנבחרה. אנא בחר שעה אחרת.`
- A valid in-hours `POST /api/Reservations` succeeds locally.

Bug found and fixed during this pass:

- Public reservation creation succeeded on the backend but showed a frontend error because `RestaurantDataService.createReservation` refetched the new reservation from the protected staff endpoint after the public POST. The service now treats the successful POST response as the source of truth and updates local state from it.

Still recommended before production cutover:

- Run full Customer browser QA with a disposable customer account: register/login, account update, password change, cart, floating cart, take-away order, dine-in order, order details, reservation list/details/cancel.
- Run full Waiter browser QA with a disposable waiter account: active orders, create order, order details, status updates, add payment, waiter reservations, realtime notices.
- Run full Admin browser QA with a disposable admin account: dashboard, reports, menu/categories, tables/location/notes, users, orders/payments, reservations, business hours, realtime notices.
- Run a two-session realtime check for order and reservation updates.
- Run ownership checks with two separate customer accounts for customer orders and reservations.

## Build Checks

- Run `dotnet build backend\Restaurant.API\Restaurant.API.csproj -c Release`.
- Run the frontend production build after frontend/API contract changes.
- Verify Swagger starts and protected endpoints still show authorization requirements.
