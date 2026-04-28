namespace Restaurant.API.DTOs;

public sealed record BusinessHourResponseDto(
    int Id,
    int DayOfWeek,
    bool IsOpen,
    TimeOnly? OpenTime,
    TimeOnly? CloseTime);

public sealed record UpdateBusinessHourDto(
    int DayOfWeek,
    bool IsOpen,
    TimeOnly? OpenTime,
    TimeOnly? CloseTime);

public sealed record UpdateBusinessHoursDto(IReadOnlyCollection<UpdateBusinessHourDto> Hours);
