# Restaurant.API

ASP.NET Core backend for the Restaurant Management System. The backend provides REST APIs for authentication, users, menu management, tables, orders, customer orders, payments, reservations, reports, dashboard metrics, and SignalR operational events.

## Tech Stack

- .NET 8
- ASP.NET Core Web API
- Entity Framework Core 8
- SQL Server / SQL Server LocalDB
- JWT bearer authentication
- Role-based authorization
- FluentValidation
- Swagger / OpenAPI
- SignalR

## Project Layout

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
|-- Migrations/
|-- Models/
|-- Seed/
|-- Services/
|-- Validators/
|-- Program.cs
|-- appsettings.json
|-- NuGet.Config
`-- Restaurant.API.csproj
```

## Configuration

Main configuration file:

```text
appsettings.json
```

Important sections:

- `ConnectionStrings:DefaultConnection`
- `Jwt`
- `SeedAdmin`
- `Logging`

Use placeholders in documentation and secure values outside source control for shared environments:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=RestaurantManagementDb;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "Jwt": {
    "Issuer": "Restaurant.API",
    "Audience": "Restaurant.Client",
    "Secret": "<at-least-32-byte-secret>",
    "ExpirationMinutes": 120
  },
  "SeedAdmin": {
    "Email": "admin@example.local",
    "Password": "<local-dev-password>",
    "FirstName": "System",
    "LastName": "Admin",
    "PhoneNumber": "0500000000"
  }
}
```

The application validates JWT settings at startup. The secret must be at least 32 UTF-8 bytes and must not be a placeholder.

## Database Setup

The backend uses EF Core with SQL Server. The checked-in local connection string targets SQL Server LocalDB:

```text
Server=(localdb)\MSSQLLocalDB;Database=RestaurantManagementDb;Trusted_Connection=True;TrustServerCertificate=True
```

Install the EF Core CLI if needed:

```powershell
dotnet tool install --global dotnet-ef
```

Apply migrations from this folder:

```powershell
dotnet ef database update
```

Startup also runs the seed path through `AdminSeeder`. If migrations exist, startup applies `MigrateAsync`; otherwise local development can initialize with `EnsureCreatedAsync`.

## Run Locally

From `backend/Restaurant.API`:

```powershell
dotnet restore --configfile NuGet.Config
dotnet run --launch-profile http
```

Default HTTP URL:

```text
http://localhost:5084
```

HTTPS launch profile:

```powershell
dotnet run --launch-profile https
```

Configured URLs:

```text
https://localhost:7066
http://localhost:5084
```

## Build

```powershell
dotnet build
```

Release build:

```powershell
dotnet build -c Release
```

## Swagger

Swagger is enabled in development.

```text
http://localhost:5084/swagger
```

Use `POST /api/Auth/login` to obtain a JWT and authorize Swagger with:

```text
Bearer <token>
```

## Roles and Permissions

Roles:

- `Admin`
- `Waiter`
- `Customer`

Public endpoints:

- `POST /api/Auth/register`
- `POST /api/Auth/login`
- public menu reads
- `POST /api/Reservations`

Authenticated user endpoints:

- `GET /api/Auth/me`
- `PUT /api/Auth/me`
- `PUT /api/Auth/me/password`

Customer-only endpoints:

- `/api/customer/orders`
- `/api/customer/tables/available`

Admin/waiter endpoints:

- operational orders
- payments create and order-payment reads
- table reads and table status updates
- reservation reads

Admin-only endpoints:

- users
- admin account creation
- menu writes and category writes
- table create/update
- reservation update/status/delete
- reports
- dashboard
- all-payment tracking

## Main API Areas

Authentication:

- `POST /api/Auth/register`
- `POST /api/Auth/login`
- `GET /api/Auth/me`
- `PUT /api/Auth/me`
- `PUT /api/Auth/me/password`

Menu:

- public reads from `GET /api/Menu`, `GET /api/Menu/{id}`, `GET /api/Menu/categories`
- admin create/update/delete menu items
- admin image management
- admin create/update/delete categories

Tables:

- admin/waiter reads
- admin create/update
- admin/waiter status updates

Orders:

- admin/waiter create/update/read
- status updates
- item add/update/delete
- table assignment updates
- optional date/status/payment/order-type query filters

Customer orders:

- customer-only order list and details
- customer-only create/update
- customer-only item add/update/delete
- customer-only available table options
- totals and identity are calculated/derived server-side

Payments:

- admin/waiter create payments
- admin/waiter get payments by order
- admin-only payment tracking with date filters

Reservations:

- public reservation creation
- admin/waiter reads with date/status/phone filters
- admin update/status/delete
- delete marks reservations cancelled

Reports and dashboard:

- admin dashboard summary
- daily, weekly, monthly, yearly reports
- sales report
- top and least ordered dishes
- payment breakdown
- peak hours
- waiter performance
- reservation summary
- table occupancy

SignalR:

- hub path: `/hubs/restaurant`
- emitted events include `orderCreated`, `orderUpdated`, `orderStatusUpdated`, `paymentAdded`, `reservationCreated`, and `reservationStatusUpdated`
- JWT can be supplied with the `access_token` query parameter for hub clients

## Important Business Rules

- Public registration creates customers only.
- Admin and waiter accounts are created by admins.
- Password hashes are never returned by API responses.
- Customers can only access their own customer orders.
- Customer identity is derived from JWT claims, not request body data.
- Order prices and totals are calculated server-side.
- Dine-in customer orders require a valid available table.
- Takeaway customer orders do not require a table.
- Customer orders cannot be modified after payment or cancellation.
- Menu item ordering requires the item and its category to be available/active.
- Payments reject overpayment and paid-order duplicate payment attempts.
- User deletion blocks deleting the active admin account and blocks deleting the last admin.
- Menu category deletion blocks categories that still have menu items.
- Reservation creation is a request; final approval is managed by staff.

## CORS

The default CORS policy allows:

```text
http://localhost:4200
http://127.0.0.1:4200
```

It allows credentials for SignalR. Add real frontend origins before testing from a network IP or deploying.

## Troubleshooting

LocalDB / SQL Server:

- Confirm SQL Server LocalDB is installed if using the default connection string.
- Override `ConnectionStrings:DefaultConnection` for SQL Server Express, Docker, or cloud SQL Server.

JWT startup failure:

- Ensure `Jwt:Issuer`, `Jwt:Audience`, `Jwt:Secret`, and `Jwt:ExpirationMinutes` are configured.
- `Jwt:Secret` must be at least 32 UTF-8 bytes.

CORS:

- If the Angular app runs from another origin, add that origin to `AppCorsPolicies.DefaultCors` configuration in `ServiceCollectionExtensions.cs`.

Running on a network:

- The API can be reached by other devices only if it binds to a reachable host and firewall rules allow the port.
- Update frontend `apiBaseUrl` away from `localhost` when testing from another device.
- For temporary local network testing, run without a launch profile and set a reachable URL, for example:

```powershell
$env:ASPNETCORE_URLS = "http://0.0.0.0:5084"
dotnet run
```

- Add the matching frontend origin to CORS before testing from another machine.

Locked executable during debug build:

- Stop the running API process before rebuilding.
- On Windows, check for running `Restaurant.API.exe` or `dotnet` processes if build output files are locked.

Swagger 401/403:

- Log in, copy the JWT, click `Authorize`, and provide the bearer token.
- Confirm the token role matches the endpoint being called.

## Needs Verification

- Automated backend test project is not present in this repository snapshot.
- Frontend SignalR client integration is not currently visible; the backend emits events, but the frontend appears to rely on HTTP refresh flows.
