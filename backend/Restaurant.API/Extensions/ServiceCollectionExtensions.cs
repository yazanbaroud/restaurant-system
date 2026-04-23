using System.Text;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Restaurant.API.Data;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Seed;
using Restaurant.API.Services;
using Restaurant.API.Validators;

namespace Restaurant.API.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRestaurantBackend(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
        ValidateJwtSettings(jwt);

        services.AddOptions<JwtSettings>()
            .Bind(configuration.GetSection("Jwt"))
            .Validate(settings =>
            {
                try
                {
                    ValidateJwtSettings(settings);
                    return true;
                }
                catch
                {
                    return false;
                }
            }, "JWT settings are invalid. Configure Jwt:Issuer, Jwt:Audience, a strong Jwt:Secret of at least 32 UTF-8 bytes, and a positive Jwt:ExpirationMinutes.")
            .ValidateOnStart();

        services.Configure<SeedAdminOptions>(configuration.GetSection("SeedAdmin"));

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

        services.AddCors(options =>
        {
            options.AddPolicy(AppCorsPolicies.DefaultCors, policy =>
            {
                policy.WithOrigins("http://localhost:4200")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IUsersService, UsersService>();
        services.AddScoped<IMenuService, MenuService>();
        services.AddScoped<ITablesService, TablesService>();
        services.AddScoped<IOrdersService, OrdersService>();
        services.AddScoped<IPaymentsService, PaymentsService>();
        services.AddScoped<IReservationsService, ReservationsService>();
        services.AddScoped<IReportsService, ReportsService>();
        services.AddScoped<IDashboardService, DashboardService>();

        services.AddControllers();
        services.AddFluentValidationAutoValidation();
        services.AddValidatorsFromAssemblyContaining<RegisterDtoValidator>();
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
                    }
                };
            });
        services.AddAuthorization();

        return services;
    }

    private static void ValidateJwtSettings(JwtSettings settings)
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

        if (settings.ExpirationMinutes <= 0)
        {
            throw new InvalidOperationException("JWT configuration is invalid: Jwt:ExpirationMinutes must be greater than zero.");
        }
    }
}
