# Free Demo Deployment

This guide prepares a zero-cost testing/demo deployment only. It intentionally keeps SQL Server support intact for future production and does not add any external payment provider.

## Current Demo URLs

- Frontend: https://restaurant-system-tawny.vercel.app
- Backend: https://restaurant-system-9iut.onrender.com
- Backend API base: https://restaurant-system-9iut.onrender.com/api

## Supported Modes

### Future Local/Production Mode

- `DatabaseProvider=SqlServer`
- `ConnectionStrings__DefaultConnection=<sql-server-connection-string>`
- Existing EF SQL Server migrations remain the production migration path.

### Free Demo Mode

- `DatabaseProvider=SQLite`
- `ConnectionStrings__SqliteConnection=Data Source=app.db`
- SQLite uses `EnsureCreated` at startup for demo only. The SQL Server migrations are not deleted or converted.

## Backend: Render Free Web Service

Use Render only for a demo backend. Render documents Free web services as non-production and notes that they can spin down after idle time and lose local filesystem changes, including local SQLite files, on redeploy/restart/spin-down.

Render setup:

1. Create a new Web Service from the repository.
2. Keep the Docker build context directory as the repository root: `.`.
3. Set Dockerfile path to `backend/Restaurant.API/Dockerfile`.
4. Select the Free instance type.
5. Add environment variables:

```text
ASPNETCORE_ENVIRONMENT=Production
DatabaseProvider=SQLite
ConnectionStrings__SqliteConnection=Data Source=app.db
Jwt__Secret=<at-least-32-byte-random-secret>
Jwt__Issuer=Restaurant.API
Jwt__Audience=Restaurant.Client
Jwt__ExpirationMinutes=15
Jwt__RefreshTokenExpirationDays=30
SeedAdmin__Email=admin@example.com
SeedAdmin__Password=<strong-demo-password>
SeedAdmin__FirstName=Demo
SeedAdmin__LastName=Admin
SeedAdmin__PhoneNumber=0000000000
AllowedOrigins__0=https://restaurant-system-tawny.vercel.app
```

Notes:

- Do not use `Admin123!` in Production; startup rejects the local development seed password.
- Render sets `PORT`; the API binds to it automatically when `ASPNETCORE_URLS` is not set.
- Free Render SQLite data is disposable. If the service restarts, spins down, or redeploys, the demo database can be lost.

## Frontend: Vercel Free

Use Vercel for the Angular static frontend.

Vercel setup:

1. Import the repository into Vercel.
2. Set the project root directory to `frontend`.
3. Use build command `npm run build`.
4. Set output directory `dist/hakeves-restaurant-frontend/browser`.
5. Add environment variable:

```text
API_URL=https://restaurant-system-9iut.onrender.com
```

The build script writes `public/app-config.js` from `API_URL`, and the Angular app reads that runtime config before bootstrapping. Set `API_URL` to the backend origin without `/api`; the frontend services append `/api/...` themselves. If `/api` is accidentally included, the build script strips the trailing `/api` to avoid double `/api/api/...` URLs.

## Local Run

Backend:

```powershell
cd backend/Restaurant.API
dotnet restore --configfile NuGet.Config
dotnet run --launch-profile http
```

Frontend:

```powershell
cd frontend
npm install
npm start
```

Local defaults:

- Backend: `http://localhost:5084`
- Frontend: `http://localhost:4200`
- Frontend development API base: `http://localhost:5084`

## Roles and Entry Points

- `Admin`: `/admin` for dashboard, menu, users, tables, reservations, payments, reports, and business hours.
- `Waiter`: `/waiter` for tables, order creation, active orders, payments, and operational reservations.
- `Kitchen`: `/waiter/kitchen` for kitchen orders and item/order readiness actions.
- `Salad`: `/waiter/salads` for salad-station orders only.
- `Customer`: `/cart`, `/orders`, and `/reservations` for authenticated customer flows.
- Public guest: `/`, `/menu`, `/reservation`.

## Demo QA Checklist

- Public: open home/menu/reservation on desktop and mobile widths; submit invalid reservation form and verify Hebrew validation.
- Admin: log in, open dashboard, menu, users, tables, reservations, payments, and reports; approve/reject a pending reservation.
- Waiter: open tables, create an order, view active order details, and record a manual payment.
- Salad: open `/waiter/salads` directly and confirm only salad workflow navigation is visible.
- Kitchen: open `/waiter/kitchen`, update item statuses, and confirm ready/served actions are only in the kitchen workflow.
- Network: turn offline mode on in the browser and confirm the Hebrew no-connection banner blocks unsafe write actions.

## SQLite Limitations

- SQLite is single-file storage and is acceptable here only for a free demo.
- Render Free web services do not provide persistent disks, so `app.db` is not durable.
- Free demo data should be treated as resettable.
- Render Free services can sleep after inactivity, so the first request after idle time may be slow or fail until the service wakes.
- Do not use SQLite-on-Render-Free for a real restaurant, financial records, audit retention, or operational reporting.

## Before Real Paid Production

- Switch back to `DatabaseProvider=SqlServer`.
- Use `ConnectionStrings__DefaultConnection` against a real SQL Server instance.
- Run and monitor EF migrations as part of deployment.
- Add database backups, restore drills, monitoring, and alerting.
- Use durable image/file storage instead of local filesystem writes.
- Add CI/CD gates for backend tests and Angular production builds.
- Use production-grade secret management and rotate `Jwt__Secret`.

## References

- Render Free limitations: https://render.com/docs/free
- Render environment variables and `PORT`: https://render.com/docs/environment-variables
- Vercel environment variables: https://vercel.com/docs/environment-variables
