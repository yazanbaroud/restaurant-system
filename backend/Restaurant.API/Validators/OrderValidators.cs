using FluentValidation;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;

namespace Restaurant.API.Validators;

public sealed class CreateOrderDtoValidator : AbstractValidator<CreateOrderDto>
{
    public CreateOrderDtoValidator()
    {
        RuleFor(x => x.OrderType).IsInEnum();
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).SetValidator(new CreateOrderItemDtoValidator());
        RuleFor(x => x.TableIds)
            .Must(ids => ids is not null && ids.Count > 0)
            .When(x => x.OrderType == OrderType.DineIn)
            .WithMessage("Dine-in orders require at least one table.");
    }
}

public sealed class CreateOrderItemDtoValidator : AbstractValidator<CreateOrderItemDto>
{
    public CreateOrderItemDtoValidator()
    {
        RuleFor(x => x.MenuItemId).GreaterThan(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class AddOrderItemDtoValidator : AbstractValidator<AddOrderItemDto>
{
    public AddOrderItemDtoValidator()
    {
        RuleFor(x => x.MenuItemId).GreaterThan(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class UpdateOrderDtoValidator : AbstractValidator<UpdateOrderDto>
{
    public UpdateOrderDtoValidator()
    {
        RuleFor(x => x.OrderType).IsInEnum();
        RuleFor(x => x.CustomerFirstName).MaximumLength(100);
        RuleFor(x => x.CustomerLastName).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}

public sealed class UpdateOrderStatusDtoValidator : AbstractValidator<UpdateOrderStatusDto>
{
    public UpdateOrderStatusDtoValidator() => RuleFor(x => x.Status).IsInEnum();
}

public sealed class UpdateOrderTablesDtoValidator : AbstractValidator<UpdateOrderTablesDto>
{
    public UpdateOrderTablesDtoValidator() => RuleFor(x => x.TableIds).NotNull();
}

public sealed class UpdateOrderItemDtoValidator : AbstractValidator<UpdateOrderItemDto>
{
    public UpdateOrderItemDtoValidator()
    {
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}
