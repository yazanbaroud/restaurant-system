namespace Restaurant.API.Enums;

public enum PaymentStatus
{
    Unpaid = 1,
    Paid = 2,
    PartiallyPaid = 3,
    Partial = PartiallyPaid,
    Refunded = 4
}
