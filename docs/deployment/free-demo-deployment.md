# Free Demo Deployment

This guide prepares a zero-cost testing/demo deployment only. It intentionally keeps SQL Server support intact for future production and does not add any external payment provider.

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
2. Set the root directory to `backend/Restaurant.API`.
3. Use Docker deployment with `backend/Restaurant.API/Dockerfile`.
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
AllowedOrigins__0=https://your-vercel-url.vercel.app
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
APP_API_BASE_URL=https://your-render-service.onrender.com
```

The build script writes `public/app-config.js` from `APP_API_BASE_URL`, and the Angular app reads that runtime config before bootstrapping.

## SQLite Limitations

- SQLite is single-file storage and is acceptable here only for a free demo.
- Render Free web services do not provide persistent disks, so `app.db` is not durable.
- Free demo data should be treated as resettable.
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
