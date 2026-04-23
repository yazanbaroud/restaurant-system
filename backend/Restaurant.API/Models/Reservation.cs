using Restaurant.API.Enums;

namespace Restaurant.API.Models;

public sealed class Reservation
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public DateOnly ReservationDate { get; set; }
    public TimeOnly ReservationTime { get; set; }
    public int GuestsCount { get; set; }
    public string? CustomerNotes { get; set; }
    public string? RestaurantNotes { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
