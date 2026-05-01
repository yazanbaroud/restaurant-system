using Restaurant.API.Enums;
using Restaurant.API.Models;

namespace Restaurant.API.Interfaces;

public interface IOrderStateService
{
    void Initialize(Order order, int changedByUserId, DateTime utcNow);
    bool AdvanceKitchenStatus(Order order, int changedByUserId, DateTime utcNow);
    bool ApplyOrderItemStatus(Order order, OrderItem item, OrderItemStatus status, int changedByUserId, DateTime utcNow);
    bool ApplyPaymentStatus(Order order, decimal totalAmount, decimal paidAmount, int changedByUserId, DateTime utcNow);
    bool MarkPaidFromExistingPayments(Order order, decimal paidAmount, int changedByUserId, DateTime utcNow);
    void Cancel(Order order, int changedByUserId, DateTime utcNow);
    void EnsureItemsCanBeChanged(Order order);
    bool IsActive(Order order);
}
