using FluentValidation;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;

namespace Restaurant.API.Validators;

public sealed class CreateUserDtoValidator : AbstractValidator<CreateUserDto>
{
    public CreateUserDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
        RuleFor(x => x.Role).IsInEnum();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("הסיסמה חייבת להכיל אות גדולה באנגלית.")
            .Matches("[a-z]").WithMessage("הסיסמה חייבת להכיל אות קטנה באנגלית.")
            .Matches("[0-9]").WithMessage("הסיסמה חייבת להכיל ספרה.");
    }
}

public sealed class UpdateUserDtoValidator : AbstractValidator<UpdateUserDto>
{
    public UpdateUserDtoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("מספר טלפון הוא שדה חובה")
            .MaximumLength(40)
            .Matches(ValidationPatterns.IsraeliPhone).WithMessage("מספר הטלפון אינו תקין");
    }
}

public sealed class UpdateUserRoleDtoValidator : AbstractValidator<UpdateUserRoleDto>
{
    public UpdateUserRoleDtoValidator()
    {
        RuleFor(x => x.Role).IsInEnum();
    }
}

public sealed class ResetUserPasswordDtoValidator : AbstractValidator<ResetUserPasswordDto>
{
    public ResetUserPasswordDtoValidator()
    {
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("הסיסמה חייבת להכיל אות גדולה באנגלית.")
            .Matches("[a-z]").WithMessage("הסיסמה חייבת להכיל אות קטנה באנגלית.")
            .Matches("[0-9]").WithMessage("הסיסמה חייבת להכיל ספרה.");
    }
}
