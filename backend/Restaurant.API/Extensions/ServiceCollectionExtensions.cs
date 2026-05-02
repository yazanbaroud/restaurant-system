using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Restaurant.API.Data;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Options;
using Restaurant.API.Seed;
using Restaurant.API.Services;
using Restaurant.API.Validators;

namespace Restaurant.API.Extensions;

public static class ServiceCollectionExtensions
{
    private const string SqlServerProvider = "SqlServer";
    private const string SqliteProvider = "SQLite";

    public static IServiceCollection AddRestaurantBackend(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var jwt = configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
        ValidateJwtSettings(jwt, environment);

        services.AddOptions<JwtSettings>()
            .Bind(configuration.GetSection("Jwt"))
            .Validate(settings =>
            {
                try
                {
                    ValidateJwtSettings(settings, environment);
                    return true;
                }
                catch
                {
                    return false;
                }
            }, "JWT settings are invalid. Configure Jwt:Issuer, Jwt:Audience, a strong Jwt:Secret of at least 32 UTF-8 bytes, and a positive Jwt:ExpirationMinutes.")
            .ValidateOnStart();

        services.Configure<SeedAdminOptions>(configuration.GetSection("SeedAdmin"));
        services.Configure<OrderLifecycleOptions>(configuration.GetSection("OrderLifecycle"));

        ConfigureDatabase(services, configuration);
        services.AddHttpContextAccessor();

        var allowedOrigins = ReadAllowedOrigins(configuration, "AllowedOrigins")
            ?? ReadAllowedOrigins(configuration, "Cors:AllowedOrigins");

        if (allowedOrigins is null || allowedOrigins.Length == 0)
        {
            if (!environment.IsDevelopment())
            {
                throw new InvalidOperationException("CORS configuration is invalid: configure Cors:AllowedOrigins for production.");
            }

            allowedOrigins = ["http://localhost:4200", "http://127.0.0.1:4200"];
        }

        services.AddCors(options =>
        {
            options.AddPolicy(AppCorsPolicies.DefaultCors, policy =>
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AppRateLimitPolicies.Login, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    RateLimitPartitionKey(context, AppRateLimitPolicies.Login),
                    _ => FixedWindow(permitLimit: 5, TimeSpan.FromMinutes(1))));
            options.AddPolicy(AppRateLimitPolicies.PublicReservation, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    RateLimitPartitionKey(context, AppRateLimitPolicies.PublicReservation),
                    _ => FixedWindow(permitLimit: 10, TimeSpan.FromMinutes(5))));
        });

        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IUsersService, UsersService>();
        services.AddScoped<IMenuService, MenuService>();
        services.AddScoped<ITablesService, TablesService>();
        services.AddScoped<IOrderTableAssignmentService, OrderTableAssignmentService>();
        services.AddScoped<IOrderStateService, OrderStateService>();
        services.AddScoped<IOrdersService, OrdersService>();
        services.AddScoped<IPaymentsService, PaymentsService>();
        services.AddScoped<IReservationsService, ReservationsService>();
        services.AddScoped<IBusinessHoursService, BusinessHoursService>();
        services.AddScoped<IReportsService, ReportsService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IRestaurantRealtimeNotifier, RestaurantRealtimeNotifier>();

        services.AddControllers();
        services.AddFluentValidationAutoValidation();
        services.AddValidatorsFromAssemblyContaining<LoginDtoValidator>();
        services.AddSignalR();
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Restaurant Management API",
                Version = "v1"
            });
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Enter a valid JWT bearer token."
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
        });

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateIssuerSigningKey = true,
                    ValidateLifetime = true,
                    ValidIssuer = jwt.Issuer,
                    ValidAudience = jwt.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
                    ClockSkew = TimeSpan.FromMinutes(1)
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;

                        if (!string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/hubs/restaurant"))
                        {
                            context.Token = accessToken;
                        }

                        return Task.CompletedTask;
                    },
                    OnTokenValidated = async context =>
                    {
                        var userIdValue = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                        var tokenVersionValue = context.Principal?.FindFirstValue(AppClaimTypes.TokenVersion);

                        if (!int.TryParse(userIdValue, out var userId) ||
                            !int.TryParse(tokenVersionValue, out var tokenVersion))
                        {
                            context.Fail("Access token is missing required user claims.");
                            return;
                        }

                        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                        var userState = await db.Users.AsNoTracking()
                            .Where(x => x.Id == userId)
                            .Select(x => new { x.IsActive, x.TokenVersion })
                            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);

                        if (userState is null || !userState.IsActive || userState.TokenVersion != tokenVersion)
                        {
                            context.Fail("Access token has been revoked.");
                        }
                    }
                };
            });
        services.AddAuthorization();

        return services;
    }

    private static void ConfigureDatabase(IServiceCollection services, IConfiguration configuration)
    {
        var provider = configuration["DatabaseProvider"];
        provider = string.IsNullOrWhiteSpace(provider) ? SqlServerProvider : provider.Trim();

        if (provider.Equals(SqlServerProvider, StringComparison.OrdinalIgnoreCase))
        {
            var connectionString = GetRequiredConnectionString(configuration, "DefaultConnection", SqlServerProvider);
            services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
            return;
        }

        if (provider.Equals(SqliteProvider, StringComparison.OrdinalIgnoreCase)
            || provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            var connectionString = configuration.GetConnectionString("SqliteConnection");
            connectionString = string.IsNullOrWhiteSpace(connectionString)
                ? "Data Source=app.db"
                : connectionString.Trim();
            EnsureSqliteDirectoryExists(connectionString);
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
            return;
        }

        throw new InvalidOperationException("DatabaseProvider must be either SqlServer or SQLite.");
    }

    private static string GetRequiredConnectionString(IConfiguration configuration, string name, string provider)
    {
        var connectionString = configuration.GetConnectionString(name);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException($"{provider} requires ConnectionStrings:{name}.");
        }

        return connectionString;
    }

    private static void EnsureSqliteDirectoryExists(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        var dataSource = builder.DataSource;
        if (string.IsNullOrWhiteSpace(dataSource)
            || dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var directory = Path.GetDirectoryName(Path.GetFullPath(dataSource));
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }
    }

    private static string[]? ReadAllowedOrigins(IConfiguration configuration, string sectionName)
    {
        return configuration.GetSection(sectionName)
            .Get<string[]>()
            ?.Where(origin => !string.IsNullOrWhiteSpace(origin))
            .Select(origin => origin.Trim().TrimEnd('/'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static void ValidateJwtSettings(JwtSettings settings, IHostEnvironment environment)
    {
        if (string.IsNullOrWhiteSpace(settings.Issuer))
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:Issuer is required.");
        }

        if (string.IsNullOrWhiteSpace(settings.Audience))
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:Audience is required.");
        }

        if (string.IsNullOrWhiteSpace(settings.Secret))
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:Secret is required.");
        }

        if (Encoding.UTF8.GetByteCount(settings.Secret) < 32)
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:Secret must be at least 32 UTF-8 bytes.");
        }

        if (settings.Secret.Contains("CHANGE_THIS", StringComparison.OrdinalIgnoreCase)
            || settings.Secret.Contains("PLACEHOLDER", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:Secret must not use a placeholder value.");
        }

        if (!environment.IsDevelopment()
            && (settings.Secret.Contains("LOCAL_DEV_ONLY", StringComparison.OrdinalIgnoreCase)
                || settings.Secret.Contains("NotForProduction", StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("JWT configuration is invalid: production must use a deployment-specific Jwt:Secret.");
        }

        if (settings.ExpirationMinutes <= 0)
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:ExpirationMinutes must be greater than zero.");
        }

        if (settings.RefreshTokenExpirationDays <= 0)
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:RefreshTokenExpirationDays must be greater than zero.");
        }
    }

    private static FixedWindowRateLimiterOptions FixedWindow(int permitLimit, TimeSpan window) =>
        new()
        {
            PermitLimit = permitLimit,
            Window = window,
            QueueLimit = 0,
            AutoReplenishment = true
        };

    private static string RateLimitPartitionKey(HttpContext context, string policy)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(userId))
        {
            return $"{policy}:user:{userId}";
        }

        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return $"{policy}:ip:{ip}";
    }
}
