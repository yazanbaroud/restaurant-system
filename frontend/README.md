# Hakeves Restaurant Frontend

Angular frontend for the Restaurant Management System. The app is a Hebrew/RTL restaurant experience with public pages, authenticated customer ordering, waiter operations, and admin management screens.

## Tech Stack

- Angular 21 standalone components
- Angular Router
- Reactive Forms
- HttpClient with JWT interceptor
- RxJS
- SCSS
- Hebrew locale (`he-IL`)

## Main Features

Public:

- Home page with hero content and a small featured menu teaser.
- Public menu with search, category filtering, sorting, dish details, and add-to-cart prompts.
- Public reservation request form.
- Login and customer registration.

Customer:

- Client-side cart stored per customer in `localStorage`.
- Add/update/remove cart items from menu and dish detail pages.
- Submit dine-in or takeaway orders through customer-only API endpoints.
- Select an available table for dine-in orders.
- View own order history and order details.
- View order status and payment status as read-only.
- Account/profile page and own password change.

Waiter:

- Active orders dashboard.
- Create order flow.
- Shared order details and payment pages under waiter routes.
- Reservation list with filtering.

Admin:

- Dashboard and reports.
- Admin-native order creation/details/payment routes.
- Menu item and category management.
- Table list and form pages.
- User/staff management with password reset and delete safeguards.
- Reservation management with approval/rejection notes.
- Payment tracking.

## Folder Structure

```text
frontend/
|-- angular.json
|-- package.json
|-- src/
|   |-- environments/
|   |   |-- environment.ts
|   |   `-- environment.development.ts
|   |-- main.ts
|   `-- app/
|       |-- app.routes.ts
|       |-- core/
|       |   |-- guards/
|       |   |-- interceptors/
|       |   |-- layout/
|       |   |-- models/
|       |   `-- services/
|       |-- features/
|       |   |-- account/
|       |   |-- admin/
|       |   |-- auth/
|       |   |-- customer/
|       |   |-- public/
|       |   `-- waiter/
|       `-- shared/
|           |-- components/
|           |-- pipes/
|           |-- form-validation.ts
|           `-- ui-labels.ts
```

## Environment and API Configuration

The API base URL is configured in:

```text
src/environments/environment.ts
src/environments/environment.development.ts
```

Development value:

```ts
apiBaseUrl: 'http://localhost:5084'
```

Production defaults to a same-origin API base URL:

```ts
apiBaseUrl: ''
```

That makes calls resolve to `/api/...`, which fits deployments where the frontend and backend are served behind the same reverse proxy. If production uses a separate API host, add a deployment-specific environment replacement instead of hardcoding URLs in services.

For production deployments:

- Same-origin deployment: keep `apiBaseUrl: ''` and route `/api` plus `/hubs/restaurant` to the backend through the reverse proxy.
- Separate frontend/API domains: create a production environment replacement with the API origin, for example `https://api.example.com`.
- Update backend `Cors:AllowedOrigins` to include the exact frontend origin.
- Keep `enableMockFallbacks: false`; production must not silently show mock data when API reads fail.

For network-device testing, use a reachable backend URL instead of `localhost`. Example:

```ts
apiBaseUrl: 'http://192.168.1.20:5084'
```

The backend CORS policy must also allow the frontend origin.

## Install Dependencies

```powershell
cd frontend
npm install
```

## Run Locally

```powershell
npm.cmd start
```

Equivalent npm script:

```powershell
npm run start
```

The dev server uses:

```text
http://localhost:4200
```

The configured script runs:

```text
ng serve --host 0.0.0.0 --port 4200
```

## Production Build

```powershell
npm.cmd run build -- --configuration production
```

Output folder:

```text
dist/hakeves-restaurant-frontend
```

## Available Scripts

```json
{
  "ng": "ng",
  "start": "ng serve --host 0.0.0.0 --port 4200",
  "build": "ng build",
  "watch": "ng build --watch --configuration development"
}
```

## Route and Role Overview

Guest/public routes:

- `/`
- `/menu`
- `/menu/:id`
- `/reservation`
- `/login`
- `/register`

Authenticated customer routes:

- `/account`
- `/cart`
- `/orders`
- `/orders/:id`
- `/reservations`
- `/reservations/:id`

Waiter routes:

- `/waiter`
- `/waiter/create-order`
- `/waiter/orders/:id`
- `/waiter/orders/:id/payment`
- `/waiter/reservations`

Admin routes:

- `/admin`
- `/admin/orders`
- `/admin/orders/new`
- `/admin/orders/:id`
- `/admin/orders/:id/payment`
- `/admin/reservations`
- `/admin/menu`
- `/admin/menu/new`
- `/admin/menu/:id/edit`
- `/admin/tables`
- `/admin/tables/new`
- `/admin/tables/:id/edit`
- `/admin/users`
- `/admin/users/new`
- `/admin/users/:id/edit`
- `/admin/payments`
- `/admin/business-hours`
- `/admin/reports`

Route access is enforced by `roleGuard` in `src/app/core/guards/role.guard.ts`. JWTs are attached by `authInterceptor` from `src/app/core/interceptors/auth.interceptor.ts`.

## Customer Cart and Order Flow

- Cart state is client-side only and is stored in `localStorage` under a key scoped to the customer ID.
- Guests can see cart/order calls to action, but attempting cart actions redirects to login.
- Only users with the `Customer` role can access `/cart`, `/orders`, and `/orders/:id`.
- Cart submission calls `POST /api/customer/orders`.
- Dine-in customer orders require an available table.
- Takeaway orders do not require a table.
- Customer payment is not implemented in the frontend. Customers only see `paymentStatus` as read-only.

## Reservation Flow

- Public users can submit reservation requests from `/reservation`.
- The page communicates with `POST /api/Reservations`.
- The UI presents the request as pending final confirmation. It does not promise automatic approval.
- The page reads public business hours from `GET /api/business-hours` and blocks closed days or out-of-hours times in the UI.
- Backend reservation validation remains the source of truth for business hours.
- Logged-in customers can view and cancel their own reservations from `/reservations`.
- Admins manage reservation status and restaurant notes from admin pages.
- Waiters can view reservations for operational awareness.

## Troubleshooting

Backend URL mismatch:

- If API calls fail, confirm `apiBaseUrl` matches the running backend URL.
- The default is `http://localhost:5084`.
- When testing on another device, `localhost` refers to that device, not your development machine.

CORS errors:

- Backend CORS reads allowed origins from `Cors:AllowedOrigins`.
- Add the actual frontend origin in backend configuration for network or deployed environments.

`ng` not found:

- Use npm scripts instead of calling `ng` directly:

```powershell
npm.cmd start
npm.cmd run build -- --configuration production
```

Port 4200 already in use:

- Stop the existing Angular dev server or run another instance on a different port.

Angular build budget warnings:

- Production budgets are configured in `angular.json`.
- If the initial bundle grows, inspect route/component imports before raising budget limits.

Stale UI in browser:

- Restart `npm.cmd start` if hot reload stops responding.
- Hard refresh the browser after major route or standalone component changes.
