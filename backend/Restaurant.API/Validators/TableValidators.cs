using FluentValidation;
using Restaurant.API.DTOs;

namespace Restaurant.API.Validators;

public sealed class CreateTableDtoValidator : AbstractValidator<CreateTableDto>
{
    public CreateTableDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Capacity).GreaterThan(0);
        RuleFor(x => x.Location).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class UpdateTableDtoValidator : AbstractValidator<UpdateTableDto>
{
    public UpdateTableDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Capacity).GreaterThan(0);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Location).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class UpdateTableStatusDtoValidator : AbstractValidator<UpdateTableStatusDto>
{
    public UpdateTableStatusDtoValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
    }
}
