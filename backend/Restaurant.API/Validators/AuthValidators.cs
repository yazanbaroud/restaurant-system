using FluentValidation;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;

namespace Restaurant.API.Validators;

public sealed class RegisterDtoValidator : AbstractValidator<RegisterDto>
{
    public RegisterDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("הסיסמה חייבת להכיל אות גדולה באנגלית.")
            .Matches("[a-z]").WithMessage("הסיסמה חייבת להכיל אות קטנה באנגלית.")
            .Matches("[0-9]").WithMessage("הסיסמה חייבת להכיל ספרה.");
    }
}

public sealed class LoginDtoValidator : AbstractValidator<LoginDto>
{
    public LoginDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class CreateWaiterDtoValidator : AbstractValidator<CreateWaiterDto>
{
    public CreateWaiterDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("הסיסמה חייבת להכיל אות גדולה באנגלית.")
            .Matches("[a-z]").WithMessage("הסיסמה חייבת להכיל אות קטנה באנגלית.")
            .Matches("[0-9]").WithMessage("הסיסמה חייבת להכיל ספרה.");
    }
}

public sealed class CreateAdminDtoValidator : AbstractValidator<CreateAdminDto>
{
    public CreateAdminDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("הסיסמה חייבת להכיל אות גדולה באנגלית.")
            .Matches("[a-z]").WithMessage("הסיסמה חייבת להכיל אות קטנה באנגלית.")
            .Matches("[0-9]").WithMessage("הסיסמה חייבת להכיל ספרה.");
    }
}

public sealed class UpdateCurrentUserDtoValidator : AbstractValidator<UpdateCurrentUserDto>
{
    public UpdateCurrentUserDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
    }
}

public sealed class ChangePasswordDtoValidator : AbstractValidator<ChangePasswordDto>
{
    public ChangePasswordDtoValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("הסיסמה חייבת להכיל אות גדולה באנגלית.")
            .Matches("[a-z]").WithMessage("הסיסמה חייבת להכיל אות קטנה באנגלית.")
            .Matches("[0-9]").WithMessage("הסיסמה חייבת להכיל ספרה.");
    }
}
