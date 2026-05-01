using FluentValidation;
using Restaurant.API.DTOs;

namespace Restaurant.API.Validators;

public sealed class CreatePaymentDtoValidator : AbstractValidator<CreatePaymentDto>
{
    public CreatePaymentDtoValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0);
        RuleFor(x => x.IdempotencyKey).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

public sealed class CreatePaymentRefundDtoValidator : AbstractValidator<CreatePaymentRefundDto>
{
    public CreatePaymentRefundDtoValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0);
        RuleFor(x => x.IdempotencyKey).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}
