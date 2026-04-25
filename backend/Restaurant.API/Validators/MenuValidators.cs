using FluentValidation;
using Restaurant.API.DTOs;

namespace Restaurant.API.Validators;

public sealed class CreateMenuItemDtoValidator : AbstractValidator<CreateMenuItemDto>
{
    public CreateMenuItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.Category).GreaterThan(0);
    }
}

public sealed class UpdateMenuItemDtoValidator : AbstractValidator<UpdateMenuItemDto>
{
    public UpdateMenuItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.Category).GreaterThan(0);
    }
}

public sealed class AddMenuItemImageDtoValidator : AbstractValidator<AddMenuItemImageDto>
{
    public AddMenuItemImageDtoValidator()
    {
        RuleFor(x => x.ImageUrl).NotEmpty().MaximumLength(1000).Must(x => Uri.TryCreate(x, UriKind.Absolute, out _));
    }
}

public sealed class CreateMenuCategoryDtoValidator : AbstractValidator<CreateMenuCategoryDto>
{
    public CreateMenuCategoryDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}

public sealed class UpdateMenuCategoryDtoValidator : AbstractValidator<UpdateMenuCategoryDto>
{
    public UpdateMenuCategoryDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}
