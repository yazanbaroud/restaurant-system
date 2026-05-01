namespace Restaurant.API.Enums;

public enum KitchenStatus
{
    InSalads = 1,
    New = InSalads,
    InKitchen = 2,
    Preparing = InKitchen,
    Ready = 3,
    Served = 4
}
