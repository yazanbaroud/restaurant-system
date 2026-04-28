using FluentValidation;
using Restaurant.API.DTOs;

namespace Restaurant.API.Validators;

public sealed class UpdateBusinessHoursDtoValidator : AbstractValidator<UpdateBusinessHoursDto>
{
    public UpdateBusinessHoursDtoValidator()
    {
        RuleFor(x => x.Hours)
            .NotNull()
            .Must(x => x is not null && x.Count == 7).WithMessage("יש לעדכן את כל ימות השבוע.")
            .Must(x => x is not null && x.Select(day => day.DayOfWeek).Distinct().Count() == 7).WithMessage("ימי הפעילות אינם תקינים.");

        RuleForEach(x => x.Hours).SetValidator(new UpdateBusinessHourDtoValidator());
    }
}

public sealed class UpdateBusinessHourDtoValidator : AbstractValidator<UpdateBusinessHourDto>
{
    public UpdateBusinessHourDtoValidator()
    {
        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(0, 6)
            .WithMessage("יום הפעילות אינו תקין.");

        When(x => x.IsOpen, () =>
        {
            RuleFor(x => x.OpenTime)
                .NotNull()
                .WithMessage("יש להזין שעת פתיחה לכל יום פתוח.");
            RuleFor(x => x.CloseTime)
                .NotNull()
                .WithMessage("יש להזין שעת סגירה לכל יום פתוח.");
            RuleFor(x => x)
                .Must(x => x.OpenTime < x.CloseTime)
                .When(x => x.OpenTime.HasValue && x.CloseTime.HasValue)
                .WithMessage("שעת הפתיחה חייבת להיות לפני שעת הסגירה.");
        });
    }
}
