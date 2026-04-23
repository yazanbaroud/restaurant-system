using FluentValidation;
using Restaurant.API.DTOs;

namespace Restaurant.API.Validators;

public sealed class CreatePaymentDtoValidator : AbstractValidator<CreatePaymentDto>
{
    public CreatePaymentDtoValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Method).IsInEnum();
    }
}
