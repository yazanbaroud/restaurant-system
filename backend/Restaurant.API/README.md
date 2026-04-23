# Restaurant.API

Production-style ASP.NET Core backend for the Restaurant Management System.

This service provides the restaurant domain API for authentication, users, menu management, table management, orders, payments, reservations, reporting, dashboard metrics, and real-time operational notifications.

The project is intentionally kept as a single .NET backend project with a clean internal structure. It avoids unnecessary multi-project complexity while still separating concerns through controllers, services, DTOs, validators, EF Core models, middleware, helpers, and SignalR hubs.

## Tech Stack

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

## Architecture

The backend uses a practical layered architecture inside one API project:

- Controllers handle HTTP routing, request binding, authorization attributes, and response codes.
- Services contain business rules and database orchestration.
- Interfaces define service contracts used by dependency injection.
- DTOs define request and response payloads. EF entities are not exposed directly.
- Validators enforce request validation through FluentValidation.
- Models define EF Core entities and navigation properties.
- Data contains `AppDbContext` and EF Core relationship configuration.
- Middleware handles global exception formatting.
- Helpers contain JWT, password hashing, role constants, mapping, and small utilities.
- Hubs expose SignalR real-time notifications.
- Seed initializes the first admin account.

## Project Structure

```text
Restaurant.API/
|-- Controllers/
|-- Data/
|-- DTOs/
|-- Enums/
|-- Extensions/
|-- Helpers/
|-- Hubs/
|-- Interfaces/
|-- Middleware/
|-- Models/
|-- Seed/
|-- Services/
|-- Validators/
|-- Program.cs
|-- appsettings.json
|-- appsettings.Development.json
|-- NuGet.Config
`-- Restaurant.API.csproj
```

## Authentication and Authorization

Authentication uses JWT bearer tokens.

The API issues tokens through:

```text
POST /api/auth/login
```

Authenticated requests must include:

```text
Authorization: Bearer <token>
```

Authorization is role-based and enforced with `[Authorize]` and `[Authorize(Roles = "...")]` attributes.

Important protected areas:

- `AdminController`: Admin only
- `UsersController`: Admin only
- `ReportsController`: Admin only
- `DashboardController`: Admin only
- Menu write endpoints: Admin only
- Table creation/update endpoints: Admin only
- Table status endpoint: Admin and Waiter
- Orders endpoints: Admin and Waiter
- Payments endpoints: Admin and Waiter
- Reservation management endpoints: Admin, with limited read access for Waiter

Public endpoints are intentionally limited to:

- Customer registration
- Login
- Public menu reads
- Reservation creation

## Roles and Permissions

The system supports exactly three roles.

### Admin

Admins have full control over restaurant management:

- User and waiter account management
- Menu and menu image management
- Table management
- Orders
- Payments
- Reservations
- Reports
- Dashboard metrics

### Waiter

Waiters are operational users created by admins. They cannot self-register.

Waiters can:

- Create and update orders
- Update order status
- Manage order items
- Assign tables to orders
- Add manual payments
- View active/open orders
- View reservations for operational awareness
- Update table status where operationally appropriate

Waiters cannot access:

- User management
- Admin account creation
- Reports
- Dashboard
- Menu management
- Restaurant-wide financial analytics

### Customer

Customers can self-register and log in.

Customer registration never accepts a role from the client. Public registration always creates a `Customer` account.

Customers can:

- Register
- Log in
- Create reservations
- Browse available menu items

## JWT Configuration

JWT settings are configured in `appsettings.json` and `appsettings.Development.json`:

```json
{
  "Jwt": {
    "Issuer": "Restaurant.API",
    "Audience": "Restaurant.Client",
    "Secret": "LOCAL_DEV_ONLY_RestaurantApiJwtSecret_NotForProduction_2026_04_24",
    "ExpirationMinutes": 120
  }
}
```

The application validates JWT settings at startup. Startup fails clearly if:

- issuer is missing
- audience is missing
- secret is missing
- secret is shorter than 32 UTF-8 bytes
- secret looks like a placeholder
- expiration is not positive

The checked-in secret is for local development only. Production environments must override it using environment-specific configuration, platform secrets, or a secret manager.

## SQL Server Configuration

The default local development connection string uses SQL Server LocalDB:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=RestaurantManagementDb;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

Override `ConnectionStrings:DefaultConnection` for other SQL Server instances or cloud-hosted databases.

## EF Core Migrations

Install the EF Core CLI if it is not already available:

```powershell
dotnet tool install --global dotnet-ef
```

From `backend/Restaurant.API`:

```powershell
dotnet ef migrations add InitialCreate
dotnet ef database update
```

The startup seed path is migration-friendly:

- If EF migrations exist, startup applies migrations with `MigrateAsync`.
- If no migrations exist yet, local development can still initialize the database with `EnsureCreatedAsync`.
- Admin seeding is idempotent and does not create duplicate admins.

## Seeded Admin Account

The backend seeds an initial admin account when no admin user exists.

Default local credentials:

```text
Email: admin@restaurant.local
Password: Admin123!
```

The password is hashed before storage. Override the seeded admin settings outside source control for shared or deployed environments.

## Swagger

Swagger is enabled in development.

Default access:

```text
/swagger
```

Swagger supports JWT bearer authentication:

1. Log in through `POST /api/auth/login`.
2. Copy the returned token.
3. Use Swagger's `Authorize` button.
4. Enter the bearer token.

## SignalR Hub

The real-time hub is exposed at:

```text
/hubs/restaurant
```

Supported events:

- `orderCreated`
- `orderStatusUpdated`
- `paymentAdded`
- `reservationCreated`
- `reservationStatusUpdated`

JWT bearer tokens are supported for SignalR connections through the `access_token` query parameter used by common SignalR clients.

## CORS

The backend defines a named CORS policy:

```text
DefaultCors
```

Allowed local frontend origin:

```text
http://localhost:4200
```

The policy allows headers, methods, and credentials so Angular and SignalR can work correctly during local development.

## Important Business Rules

- Public registration always creates a customer account.
- Admin and waiter accounts are created only by admins.
- Passwords are stored using secure hashing.
- Entities are not returned directly from controllers.
- Order totals are calculated server-side only.
- Client-sent totals are ignored.
- Dine-in orders require at least one available table.
- Takeaway orders do not require tables.
- Tables assigned to active orders cannot be marked available or reserved manually.
- Newly created tables start as available.
- Menu deletion is soft: `IsAvailable = false`.
- Historical order data remains intact when menu items are disabled.
- Orders must always contain at least one item.
- Order item deletion cannot leave an order empty.
- Split payments are supported.
- Overpayments are rejected.
- Additional payments against fully paid orders return a clean business error.
- Payment status is limited to `Unpaid` and `Paid`.
- Reservations are standalone and are not linked directly to orders.
- Reservation deletion marks the reservation as cancelled.
- Revenue and sales reports exclude cancelled orders.
- Cancelled counts remain visible where operationally useful.

## Local Development Setup

From the repository root:

```powershell
cd backend/Restaurant.API
```

Restore dependencies:

```powershell
dotnet restore --configfile NuGet.Config
```

Build:

```powershell
dotnet build --configfile NuGet.Config
```

Apply migrations:

```powershell
dotnet ef database update
```

Run:

```powershell
dotnet run
```

Then open:

```text
https://localhost:<port>/swagger
```

or the HTTP/HTTPS URLs shown by the .NET runtime.

## Production Notes

- Override JWT secrets through secure configuration.
- Do not use local development credentials in production.
- Use a managed SQL Server instance or hardened SQL Server deployment.
- Run migrations as part of a controlled deployment process.
- Configure CORS for real production frontend origins only.
- Enable HTTPS termination and secure headers at the hosting boundary.
- Use structured logging and centralized log aggregation.
- Add health checks for readiness and database connectivity.
- Store operational secrets outside source control.
- Review admin seed settings before first deployment.
- Consider disabling automatic database initialization in highly controlled production environments.

## Future Backend Improvements

- Refresh tokens and token revocation.
- User deactivation and account lockout.
- Audit logging for admin and financial actions.
- Pagination and sorting for large list endpoints.
- Integration tests for authorization and business rules.
- Health check endpoints.
- Rate limiting on public endpoints.
- Reservation availability based on opening hours and table capacity.
- More detailed payment reconciliation reports.
- Background jobs for no-show detection and reservation reminders.
- Cloud deployment profiles.
- Observability dashboards for API performance and failures.
