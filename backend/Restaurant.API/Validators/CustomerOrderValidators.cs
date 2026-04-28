using FluentValidation;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;

namespace Restaurant.API.Validators;

public sealed class CreateCustomerOrderDtoValidator : AbstractValidator<CreateCustomerOrderDto>
{
    public CreateCustomerOrderDtoValidator()
    {
        RuleFor(x => x.OrderType).IsInEnum();
        RuleFor(x => x.TableId)
            .GreaterThan(0)
            .When(x => x.OrderType == OrderType.DineIn)
            .WithMessage("להזמנה במסעדה יש לבחור שולחן.");
        RuleFor(x => x.Notes).MaximumLength(1000);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).SetValidator(new CustomerOrderItemInputDtoValidator());
    }
}

public sealed class UpdateCustomerOrderDtoValidator : AbstractValidator<UpdateCustomerOrderDto>
{
    public UpdateCustomerOrderDtoValidator()
    {
        RuleFor(x => x.OrderType).IsInEnum();
        RuleFor(x => x.TableId)
            .GreaterThan(0)
            .When(x => x.OrderType == OrderType.DineIn)
            .WithMessage("להזמנה במסעדה יש לבחור שולחן.");
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}

public sealed class CustomerOrderItemInputDtoValidator : AbstractValidator<CustomerOrderItemInputDto>
{
    public CustomerOrderItemInputDtoValidator()
    {
        RuleFor(x => x.MenuItemId).GreaterThan(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class UpdateCustomerOrderItemDtoValidator : AbstractValidator<UpdateCustomerOrderItemDto>
{
    public UpdateCustomerOrderItemDtoValidator()
    {
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}
