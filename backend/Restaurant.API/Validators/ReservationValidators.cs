using FluentValidation;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;

namespace Restaurant.API.Validators;

public sealed class CreateReservationDtoValidator : AbstractValidator<CreateReservationDto>
{
    public CreateReservationDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
        RuleFor(x => x.GuestsCount).GreaterThan(0);
        RuleFor(x => x.CustomerNotes).MaximumLength(1000);
        RuleFor(x => x.ReservationDate).Must(x => x >= DateOnly.FromDateTime(DateTime.UtcNow.Date)).WithMessage("Reservation date cannot be in the past.");
    }
}

public sealed class UpdateReservationDtoValidator : AbstractValidator<UpdateReservationDto>
{
    public UpdateReservationDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
        RuleFor(x => x.GuestsCount).GreaterThan(0);
        RuleFor(x => x.CustomerNotes).MaximumLength(1000);
        RuleFor(x => x.RestaurantNotes).MaximumLength(1000);
        RuleFor(x => x.ReservationDate).Must(x => x >= DateOnly.FromDateTime(DateTime.UtcNow.Date)).WithMessage("Reservation date cannot be in the past.");
    }
}

public sealed class UpdateReservationStatusDtoValidator : AbstractValidator<UpdateReservationStatusDto>
{
    public UpdateReservationStatusDtoValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.RestaurantNotes).MaximumLength(1000);
    }
}
