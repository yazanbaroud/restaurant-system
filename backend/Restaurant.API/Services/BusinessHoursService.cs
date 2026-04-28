using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class BusinessHoursService(AppDbContext db) : IBusinessHoursService
{
    private static readonly TimeOnly DefaultOpenTime = new(10, 0);
    private static readonly TimeOnly DefaultCloseTime = new(23, 0);
    private const int DaysInWeek = 7;

    public async Task<IReadOnlyCollection<BusinessHourResponseDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        await EnsureDefaultsAsync(cancellationToken);
        return await db.BusinessHours
            .AsNoTracking()
            .OrderBy(x => x.DayOfWeek)
            .Select(x => x.ToBusinessHourResponse())
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<BusinessHourResponseDto>> UpdateAllAsync(UpdateBusinessHoursDto dto, CancellationToken cancellationToken)
    {
        var updates = ValidateAndNormalize(dto);
        await EnsureDefaultsAsync(cancellationToken);

        var existing = await db.BusinessHours.ToDictionaryAsync(x => x.DayOfWeek, cancellationToken);
        var now = DateTime.UtcNow;

        foreach (var update in updates)
        {
            if (!existing.TryGetValue(update.DayOfWeek, out var businessHour))
            {
                businessHour = new RestaurantBusinessHour
                {
                    DayOfWeek = update.DayOfWeek,
                    CreatedAt = now
                };
                db.BusinessHours.Add(businessHour);
            }

            businessHour.IsOpen = update.IsOpen;
            businessHour.OpenTime = update.IsOpen ? update.OpenTime : null;
            businessHour.CloseTime = update.IsOpen ? update.CloseTime : null;
            businessHour.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return await GetAllAsync(cancellationToken);
    }

    public async Task EnsureReservationTimeAllowedAsync(DateOnly reservationDate, TimeOnly reservationTime, CancellationToken cancellationToken)
    {
        if (reservationDate < DateOnly.FromDateTime(DateTime.Today))
        {
            throw new ApiException("לא ניתן לבחור תאריך שכבר עבר.", StatusCodes.Status400BadRequest);
        }

        await EnsureDefaultsAsync(cancellationToken);
        var dayOfWeek = (int)reservationDate.DayOfWeek;
        var businessHour = await db.BusinessHours
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.DayOfWeek == dayOfWeek, cancellationToken)
            ?? throw new ApiException("לא הצלחנו לבדוק את שעות הפעילות. נסה שוב.", StatusCodes.Status500InternalServerError);

        if (!businessHour.IsOpen)
        {
            throw new ApiException("המסעדה סגורה ביום שנבחר.", StatusCodes.Status400BadRequest);
        }

        if (!businessHour.OpenTime.HasValue ||
            !businessHour.CloseTime.HasValue ||
            reservationTime < businessHour.OpenTime.Value ||
            reservationTime > businessHour.CloseTime.Value)
        {
            throw new ApiException("המסעדה סגורה בשעה שנבחרה. אנא בחר שעה אחרת.", StatusCodes.Status400BadRequest);
        }
    }

    private async Task EnsureDefaultsAsync(CancellationToken cancellationToken)
    {
        if (await db.BusinessHours.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTime.UtcNow;
        for (var day = 0; day < DaysInWeek; day++)
        {
            db.BusinessHours.Add(new RestaurantBusinessHour
            {
                DayOfWeek = day,
                IsOpen = true,
                OpenTime = DefaultOpenTime,
                CloseTime = DefaultCloseTime,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static IReadOnlyCollection<UpdateBusinessHourDto> ValidateAndNormalize(UpdateBusinessHoursDto dto)
    {
        if (dto.Hours.Count != DaysInWeek)
        {
            throw new ApiException("יש לעדכן את כל ימות השבוע.", StatusCodes.Status400BadRequest);
        }

        var seenDays = new HashSet<int>();
        var normalized = new List<UpdateBusinessHourDto>(DaysInWeek);

        foreach (var hour in dto.Hours)
        {
            if (hour.DayOfWeek is < 0 or > 6 || !seenDays.Add(hour.DayOfWeek))
            {
                throw new ApiException("ימי הפעילות אינם תקינים.", StatusCodes.Status400BadRequest);
            }

            if (!hour.IsOpen)
            {
                normalized.Add(hour with { OpenTime = null, CloseTime = null });
                continue;
            }

            if (!hour.OpenTime.HasValue || !hour.CloseTime.HasValue)
            {
                throw new ApiException("יש להזין שעת פתיחה וסגירה לכל יום פתוח.", StatusCodes.Status400BadRequest);
            }

            if (hour.OpenTime.Value >= hour.CloseTime.Value)
            {
                throw new ApiException("שעת הפתיחה חייבת להיות לפני שעת הסגירה.", StatusCodes.Status400BadRequest);
            }

            normalized.Add(hour);
        }

        return normalized.OrderBy(x => x.DayOfWeek).ToArray();
    }
}
