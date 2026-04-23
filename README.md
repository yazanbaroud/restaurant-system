# Restaurant Management System

A production-style restaurant management system built as a monorepo with a .NET backend and a separate frontend application. The system supports restaurant operations across reservations, table management, menus, dine-in and takeaway orders, split payments, reporting, and real-time operational updates.

The backend is designed as a practical single-project ASP.NET Core API with clear internal layering, DTO-based contracts, role-based authorization, Entity Framework Core persistence, JWT authentication, SignalR notifications, Swagger documentation, and production-oriented validation/error handling.

## Repository Structure

```text
restaurant-system/
├── backend/
│   └── Restaurant.API/
└── frontend/
```

## System Architecture

The repository is organized as a monorepo so the backend and frontend can evolve together while remaining independently runnable.

The backend lives in `backend/Restaurant.API` and follows a pragmatic layered architecture inside one ASP.NET Core project:

- `Controllers` expose HTTP endpoints and enforce authorization.
- `Services` contain business logic and orchestration.
- `Interfaces` define service contracts for dependency injection.
- `Models` define EF Core entities.
- `DTOs` define request and response contracts.
- `Data` contains the EF Core `AppDbContext` and relationship mapping.
- `Validators` contain FluentValidation rules.
- `Middleware` contains global exception handling.
- `Helpers` contains JWT, password hashing, role constants, mapping, and utility code.
- `Hubs` contains SignalR real-time updates.
- `Seed` contains initial admin seeding.

The frontend is kept separate under `frontend/` and is expected to communicate with the backend over HTTP and SignalR.

## Tech Stack

Backend:

- .NET 8
- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- JWT Bearer authentication
- Role-based authorization
- SignalR
- Swagger / OpenAPI
- FluentValidation
- Built-in ASP.NET Core logging
- Global exception handling middleware

Frontend:

- Separate frontend application under `frontend/`
- Intended local origin: `http://localhost:4200`
- Backend CORS is configured for local frontend development

## Roles and Permissions

The system has three roles.

### Admin

Admins manage the full restaurant system:

- Users and waiter accounts
- Menu items and menu images
- Tables
- Orders
- Payments
- Reservations
- Reports
- Dashboard and statistics

The first admin account is seeded automatically by the backend.

### Waiter

Waiters are operational users. They cannot self-register and must be created by an admin.

Waiters can:

- Create orders
- Update orders
- Update order status
- Add, update, and remove order items
- Assign tables to orders
- Add manual payments
- View active/open orders
- View reservations for operational awareness
- View and update table status where operationally useful

Waiters cannot access:

- User management
- Admin endpoints
- Reports
- Admin dashboard
- Restaurant-wide analytics
- Menu management

### Customer

Customers can self-register publicly and log in. Public registration always creates a customer account; the client cannot choose a role.

Customers can:

- Register and log in
- Create reservations
- Browse available menu items through public menu endpoints

## Main Features

- JWT authentication with secure password hashing
- Strict role-based authorization
- Customer self-registration
- Admin-created waiter and admin accounts
- Menu management with multiple images per item
- Business-safe menu deletion by marking items unavailable
- Table management with lifecycle safeguards
- Dine-in and takeaway orders
- Multi-table dine-in order support
- Server-side order total calculation
- Order item management
- Split payment support
- Manual cash and credit-card payment recording
- Reservation management independent from orders
- Real-time SignalR events for operational updates
- Admin reports and dashboard metrics
- Swagger documentation with bearer-token support
- CORS support for the Angular development origin

## Important Business Rules

- Public registration always creates a `Customer` role.
- Admins and waiters cannot self-register through the public endpoint.
- Waiters are created only by admins.
- Orders never trust client-sent totals; totals are calculated server-side from menu item prices and quantities.
- Dine-in orders require at least one available table.
- Takeaway orders do not require tables.
- Tables assigned to active dine-in orders are protected from unsafe status changes.
- Orders can use one or multiple tables through an `OrderTable` join entity.
- Menu items can have multiple images.
- Menu deletion is business-safe and preserves order history by setting `IsAvailable = false`.
- Orders support split payments.
- Overpayments are rejected.
- Fully paid orders reject additional payment attempts with a clean business error.
- `PaymentStatus` remains limited to `Unpaid` and `Paid`.
- Reservations are standalone and are not linked directly to orders.
- Reservation deletion is business-safe and marks the reservation as `Cancelled`.
- Revenue and sales reports exclude cancelled orders.
- Cancelled order counts remain visible where operationally useful.

## Backend Setup

From the repository root:

```powershell
cd backend/Restaurant.API
```

Restore dependencies:

```powershell
dotnet restore --configfile NuGet.Config
```

Build the backend:

```powershell
dotnet build --configfile NuGet.Config
```

Run the backend:

```powershell
dotnet run
```

The backend uses SQL Server. The default local connection string targets LocalDB:

```json
"DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=RestaurantManagementDb;Trusted_Connection=True;TrustServerCertificate=True"
```

Update `backend/Restaurant.API/appsettings.Development.json` if your local SQL Server setup differs.

## EF Core Migrations

Install the EF Core CLI if needed:

```powershell
dotnet tool install --global dotnet-ef
```

Create the initial migration:

```powershell
cd backend/Restaurant.API
dotnet ef migrations add InitialCreate
```

Apply migrations:

```powershell
dotnet ef database update
```

The application startup is migration-friendly. When migrations exist, the backend applies them with `MigrateAsync`. For early local development before migrations exist, it can initialize the database smoothly.

## Seeded Admin Account

The backend seeds the first admin account automatically when no admin exists.

Default local credentials:

```text
Email: admin@restaurant.local
Password: Admin123!
```

These credentials are intended for local development. Change them through configuration for shared environments.

## JWT Configuration

JWT settings are configured in `appsettings.json` and `appsettings.Development.json`.

The backend validates JWT configuration at startup and fails clearly if:

- issuer is missing
- audience is missing
- secret is missing
- secret is too short
- secret is a placeholder
- expiration is invalid

For production deployments, override the JWT secret using environment-specific configuration or a secret manager.

## Swagger

When running in development, Swagger is available at:

```text
/swagger
```

Swagger supports JWT bearer authentication. Log in through `/api/auth/login`, copy the token, then authorize Swagger using the bearer token.

## SignalR

The backend exposes a SignalR hub at:

```text
/hubs/restaurant
```

Current real-time events include:

- `orderCreated`
- `orderStatusUpdated`
- `paymentAdded`
- `reservationCreated`
- `reservationStatusUpdated`

The hub is configured to work with JWT bearer tokens and local frontend CORS settings.

## Frontend Integration Notes

The frontend is expected to run separately, commonly at:

```text
http://localhost:4200
```

The backend CORS policy allows this origin with headers, methods, and credentials support for SignalR.

API access should use JWT bearer tokens for protected endpoints.

## Local Development Checklist

1. Start SQL Server LocalDB or configure another SQL Server connection string.
2. Run EF Core migrations.
3. Start the backend from `backend/Restaurant.API`.
4. Open Swagger and verify `/api/auth/login` with the seeded admin credentials.
5. Start the frontend separately from `frontend/`.
6. Confirm the frontend points to the backend API and SignalR hub URLs.

## Future Improvements

- Add refresh tokens and token revocation.
- Add user deactivation instead of only account creation.
- Add audit logging for admin actions.
- Add pagination and sorting for large list endpoints.
- Add database-backed role/permission management if business complexity grows.
- Add integration tests for authorization and business rules.
- Add health checks for database and application readiness.
- Add structured logging and centralized log shipping.
- Add deployment profiles for staging and production.
- Add rate limiting for public endpoints.
- Add reservation availability rules based on opening hours and table capacity.
- Add inventory tracking if the restaurant requires stock control.
