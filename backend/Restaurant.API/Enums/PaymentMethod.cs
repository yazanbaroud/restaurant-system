namespace Restaurant.API.Enums;

public enum PaymentMethod
{
    Cash = 1,
    CreditManual = 2,
    Card = CreditManual,
    Other = 3
}
