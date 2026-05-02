using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Models;
using Restaurant.API.Tests.Infrastructure;

namespace Restaurant.API.Tests;

public sealed class PublicReservationsTests
{
    [Fact]
    public async Task AnonymousUser_CanCreatePublicReservation()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var reservationDate = DateOnly.FromDateTime(DateTime.Today.AddDays(1));
        var reservationTime = new TimeOnly(18, 30);

        var response = await client.PostAsJsonAsync("/api/Reservations", new
        {
            firstName = "Public",
            lastName = "Guest",
            phoneNumber = "0501234567",
            reservationDate,
            reservationTime,
            durationMinutes = 120,
            guestsCount = 3,
            customerNotes = "Window table if possible"
        });
        var body = await response.Content.ReadFromJsonAsync<ReservationResponseDto>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(body);
        Assert.Equal("Public", body.FirstName);
        Assert.Equal("Guest", body.LastName);
        Assert.Equal("0501234567", body.PhoneNumber);
        Assert.Equal(3, body.GuestsCount);
        Assert.Equal(ReservationStatus.Pending, body.Status);
        Assert.True(body.TableId > 0);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.Reservations.AsNoTracking().SingleAsync(x => x.Id == body.Id);
        Assert.Null(stored.UserId);
    }
}
