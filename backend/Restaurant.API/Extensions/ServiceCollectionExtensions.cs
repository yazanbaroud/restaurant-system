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
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.Configure<SeedAdminOptions>(configuration.GetSection("SeedAdmin"));

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

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

        var jwt = configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
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
            });
        services.AddAuthorization();

        return services;
    }
}
