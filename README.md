# Restaurant Management System

Full-stack restaurant management system for a Hebrew/RTL restaurant product. The repository contains an ASP.NET Core backend and an Angular frontend that together support public browsing, reservations, authenticated customer ordering, waiter operations, and admin management.

## Monorepo Structure

```text
restaurant-system/
|-- backend/
|   `-- Restaurant.API/
|       |-- README.md
|       |-- Controllers/
|       |-- Data/
|       |-- DTOs/
|       |-- Models/
|       |-- Services/
|       |-- Validators/
|       `-- Program.cs
|-- frontend/
|   |-- README.md
|   |-- angular.json
|   |-- package.json
|   `-- src/
`-- README.md
```

## Tech Stack

Backend:

- .NET 8 / ASP.NET Core Web API
- Entity Framework Core with SQL Server
- JWT bearer authentication and role-based authorization
- FluentValidation
- Swagger / OpenAPI
- SignalR hub for operational events

Frontend:

- Angular 21 standalone components
- Angular Router, Reactive Forms, HttpClient interceptors
- RxJS
- SCSS global styling
- Hebrew locale and RTL-oriented UI

## Quick Start

### 1. Backend

```powershell
cd backend/Restaurant.API
dotnet restore --configfile NuGet.Config
dotnet build
dotnet run --launch-profile http
```

Default local backend URL:

```text
http://localhost:5084
```

Swagger in development:

```text
http://localhost:5084/swagger
```

The default database connection uses SQL Server LocalDB. Update `backend/Restaurant.API/appsettings.json` or environment-specific configuration if you use another SQL Server instance.

### 2. Frontend

```powershell
cd frontend
npm install
npm.cmd start
```

Default local frontend URL:

```text
http://localhost:4200
```

Production build:

```powershell
npm.cmd run build -- --configuration production
```

## Local Configuration

Frontend API base URL:

```text
frontend/src/environments/environment.ts
frontend/src/environments/environment.development.ts
```

Development points to:

```text
http://localhost:5084
```

Production uses a same-origin API base URL by default, so frontend calls resolve to `/api/...`. Use a deployment-specific environment replacement if the production API lives on a different host.

Backend configuration:

```text
backend/Restaurant.API/appsettings.json
```

Important sections:

- `ConnectionStrings:DefaultConnection`
- `Jwt`
- `SeedAdmin`

Do not put production secrets in source control. Use environment variables, user secrets, or deployment platform secrets for shared environments.

## Roles

The system has three roles:

- `Admin` - full management access.
- `Waiter` - operational order, payment, table, and reservation visibility.
- `Customer` - authenticated customer cart and own order history.

Seed admin configuration exists under `SeedAdmin` in backend configuration. Treat checked-in values as local development placeholders and override them outside source control for shared environments.

## Demo Role Entry Points

- Admin workspace: `/admin`
- Waiter workspace: `/waiter`
- Customer cart/orders: `/cart`, `/orders`
- Public guest flow: `/`, `/menu`, `/reservation`

Credentials are intentionally not documented here. Use local seed configuration or project-specific test accounts for development.

## Implemented Capabilities

Guest/public:

- View home page and public menu.
- View dish details.
- Create reservation requests.
- See order/cart calls to action, then redirect to login when action requires a customer account.

Customer:

- Register and log in.
- View and update personal account details.
- Change own password.
- Add menu items to a client-side cart.
- Submit customer orders as dine-in or takeaway.
- Select an available table for dine-in orders.
- View own orders and order details.
- See order status and payment status as read-only.

Waiter:

- View active operational orders.
- Create orders.
- Open order details.
- Advance/cancel/complete orders.
- Add payments through waiter routes.
- View reservations for operational awareness.

Admin:

- Dashboard and reports.
- Menu item and DB-backed category management.
- Table management.
- User and staff management, including password reset and deletion safeguards.
- Reservation management and rejection notes.
- Order management through admin-native routes.
- Payment tracking.

## High-Level Architecture

The backend exposes REST APIs and a SignalR hub. Controllers enforce authorization, services implement business logic, DTOs define public contracts, validators enforce request rules, and EF Core models persist restaurant data.

The frontend is organized by role and feature area. Public, customer, waiter, and admin pages use shared services for authentication, restaurant data, customer cart state, and customer order API calls. Protected routes use `roleGuard`; API requests attach JWTs through an HTTP interceptor.

## Known Limitations / Next Steps

- Customer payment flow is not implemented; payment is currently handled by admin/waiter pages.
- Backend emits SignalR events, but the frontend does not currently include a SignalR client integration.
- Some list endpoints and pages still rely on full-list loading rather than pagination.
- Refresh tokens and token revocation are not implemented.
- Production deployment profiles and environment-specific CORS configuration still need to be formalized.
- Automated test coverage is not documented here and appears to need verification.

## Documentation

- Frontend documentation: [frontend/README.md](frontend/README.md)
- Backend documentation: [backend/Restaurant.API/README.md](backend/Restaurant.API/README.md)
