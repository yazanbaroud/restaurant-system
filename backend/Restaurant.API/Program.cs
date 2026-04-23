using Restaurant.API.Extensions;
using Restaurant.API.Hubs;
using Restaurant.API.Middleware;
using Restaurant.API.Seed;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRestaurantBackend(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<RestaurantHub>("/hubs/restaurant");

await AdminSeeder.SeedAsync(app.Services);

app.Run();
