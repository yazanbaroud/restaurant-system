using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreateReservationDto(
    string FirstName,
    string LastName,
    string PhoneNumber,
    DateOnly ReservationDate,
    TimeOnly ReservationTime,
    int GuestsCount,
    string? CustomerNotes);

public sealed record UpdateReservationDto(
    string FirstName,
    string LastName,
    string PhoneNumber,
    DateOnly ReservationDate,
    TimeOnly ReservationTime,
    int GuestsCount,
    string? CustomerNotes,
    string? RestaurantNotes);

public sealed record UpdateReservationStatusDto(ReservationStatus Status, string? RestaurantNotes);
public sealed record ReservationResponseDto(
    int Id,
    string FirstName,
    string LastName,
    string PhoneNumber,
    DateOnly ReservationDate,
    TimeOnly ReservationTime,
    int GuestsCount,
    string? CustomerNotes,
    string? RestaurantNotes,
    ReservationStatus Status,
    DateTime CreatedAt);
