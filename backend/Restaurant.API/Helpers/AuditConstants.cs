namespace Restaurant.API.Helpers;

public static class AuditEntityTypes
{
    public const string Order = "Order";
    public const string Payment = "Payment";
    public const string User = "User";
    public const string Table = "Table";
    public const string MenuItem = "MenuItem";
    public const string Reservation = "Reservation";
}

public static class AuditActions
{
    public const string Create = "Create";
    public const string Update = "Update";
    public const string Delete = "Delete";
    public const string StatusChange = "StatusChange";
    public const string PaymentCreated = "PaymentCreated";
    public const string Cancelled = "Cancelled";
    public const string TableAssignmentChanged = "TableAssignmentChanged";
    public const string ManualStatusChange = "ManualStatusChange";
    public const string RoleChanged = "RoleChanged";
    public const string Disabled = "Disabled";
    public const string Enabled = "Enabled";
    public const string PasswordReset = "PasswordReset";
    public const string PasswordChanged = "PasswordChanged";
    public const string PriceChanged = "PriceChanged";
    public const string AvailabilityChanged = "AvailabilityChanged";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
}
