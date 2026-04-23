using FluentValidation;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;

namespace Restaurant.API.Validators;

public sealed class CreateMenuItemDtoValidator : AbstractValidator<CreateMenuItemDto>
{
    public CreateMenuItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.Category).IsInEnum();
    }
}

public sealed class UpdateMenuItemDtoValidator : AbstractValidator<UpdateMenuItemDto>
{
    public UpdateMenuItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.Category).IsInEnum();
    }
}

public sealed class AddMenuItemImageDtoValidator : AbstractValidator<AddMenuItemImageDto>
{
    public AddMenuItemImageDtoValidator()
    {
        RuleFor(x => x.ImageUrl).NotEmpty().MaximumLength(1000).Must(x => Uri.TryCreate(x, UriKind.Absolute, out _));
    }
}
