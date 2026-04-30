using Microsoft.Extensions.Options;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;
using Restaurant.API.Options;

namespace Restaurant.API.Services;

public sealed class OrderStateService(IOptions<OrderLifecycleOptions> options) : IOrderStateService
{
    private readonly OrderLifecycleOptions lifecycleOptions = options.Value;

    public void Initialize(Order order, int changedByUserId, DateTime utcNow)
    {
        order.Status = OrderStatus.Open;
        order.KitchenStatus = KitchenStatus.New;
        order.PaymentStatus = PaymentStatus.Unpaid;
        SetOrderStatusAudit(order, null, OrderStatus.Open, changedByUserId, utcNow);
        SetKitchenStatusAudit(order, null, KitchenStatus.New, changedByUserId, utcNow);
        SetPaymentStatusAudit(order, null, PaymentStatus.Unpaid, changedByUserId, utcNow);
    }

    public bool AdvanceKitchenStatus(Order order, int changedByUserId, DateTime utcNow)
    {
        EnsureOpen(order);

        var nextStatus = order.KitchenStatus switch
        {
            KitchenStatus.New => KitchenStatus.Preparing,
            KitchenStatus.Preparing => KitchenStatus.Ready,
            KitchenStatus.Ready => KitchenStatus.Served,
            KitchenStatus.Served => throw new ApiException("Order has already been served.", StatusCodes.Status409Conflict),
            _ => throw new ApiException("Unknown kitchen status.", StatusCodes.Status409Conflict)
        };

        SetKitchenStatus(order, nextStatus, changedByUserId, utcNow);
        return TryComplete(order, changedByUserId, utcNow);
    }

    public bool ApplyPaymentStatus(Order order, decimal totalAmount, decimal paidAmount, int changedByUserId, DateTime utcNow)
    {
        EnsureOpen(order);
        if (order.PaymentStatus == PaymentStatus.Refunded)
        {
            throw new ApiException("Cannot add payment to a refunded order.", StatusCodes.Status409Conflict);
        }

        SetPaymentStatus(order, PaymentStatusFor(totalAmount, paidAmount), changedByUserId, utcNow);
        return TryComplete(order, changedByUserId, utcNow);
    }

    public bool MarkPaidFromExistingPayments(Order order, decimal paidAmount, int changedByUserId, DateTime utcNow)
    {
        EnsureOpen(order);
        if (NormalizeMoney(paidAmount) < NormalizeMoney(order.TotalAmount))
        {
            throw new ApiException("Order cannot be marked paid until stored payments cover the full total.", StatusCodes.Status409Conflict);
        }

        SetPaymentStatus(order, PaymentStatus.Paid, changedByUserId, utcNow);
        return TryComplete(order, changedByUserId, utcNow);
    }

    public void Cancel(Order order, int changedByUserId, DateTime utcNow)
    {
        if (order.Status == OrderStatus.Completed)
        {
            throw new ApiException("Completed orders cannot be cancelled.", StatusCodes.Status409Conflict);
        }

        if (order.Status == OrderStatus.Cancelled)
        {
            return;
        }

        if (order.KitchenStatus == KitchenStatus.Served)
        {
            throw new ApiException("Served orders cannot be cancelled. Use a refund or comp workflow.", StatusCodes.Status409Conflict);
        }

        if (order.PaymentStatus is PaymentStatus.Partial or PaymentStatus.Paid || HasStoredPayments(order))
        {
            throw new ApiException("Orders with payments must be refunded before cancellation.", StatusCodes.Status409Conflict);
        }

        SetOrderStatus(order, OrderStatus.Cancelled, changedByUserId, utcNow);
    }

    public void EnsureItemsCanBeChanged(Order order)
    {
        EnsureOpen(order);

        if (order.PaymentStatus != PaymentStatus.Unpaid || HasStoredPayments(order))
        {
            throw new ApiException("Cannot change items after payment has started.", StatusCodes.Status409Conflict);
        }

        if (!lifecycleOptions.AllowItemsAfterServed && order.KitchenStatus == KitchenStatus.Served)
        {
            throw new ApiException("Cannot change items after the order has been served.", StatusCodes.Status409Conflict);
        }
    }

    public bool IsActive(Order order) =>
        order.Status == OrderStatus.Open;

    private static bool TryComplete(Order order, int changedByUserId, DateTime utcNow)
    {
        if (order.Status != OrderStatus.Open)
        {
            return false;
        }

        if (order.KitchenStatus != KitchenStatus.Served || order.PaymentStatus != PaymentStatus.Paid)
        {
            return false;
        }

        SetOrderStatus(order, OrderStatus.Completed, changedByUserId, utcNow);
        return true;
    }

    private static void EnsureOpen(Order order)
    {
        if (order.Status == OrderStatus.Cancelled)
        {
            throw new ApiException("Cancelled orders cannot be changed.", StatusCodes.Status409Conflict);
        }

        if (order.Status == OrderStatus.Completed)
        {
            throw new ApiException("Completed orders cannot be changed.", StatusCodes.Status409Conflict);
        }
    }

    private static void SetOrderStatus(Order order, OrderStatus nextStatus, int changedByUserId, DateTime utcNow)
    {
        if (order.Status == nextStatus)
        {
            return;
        }

        if (nextStatus == OrderStatus.Completed &&
            (order.KitchenStatus != KitchenStatus.Served || order.PaymentStatus != PaymentStatus.Paid))
        {
            throw new ApiException("Order can be completed only after it is served and fully paid.", StatusCodes.Status409Conflict);
        }

        var previousStatus = order.Status;
        order.Status = nextStatus;
        SetOrderStatusAudit(order, previousStatus, nextStatus, changedByUserId, utcNow);
    }

    private static void SetKitchenStatus(Order order, KitchenStatus nextStatus, int changedByUserId, DateTime utcNow)
    {
        if (order.KitchenStatus == nextStatus)
        {
            return;
        }

        if ((int)nextStatus < (int)order.KitchenStatus)
        {
            throw new ApiException("Kitchen status cannot move backward.", StatusCodes.Status409Conflict);
        }

        var previousStatus = order.KitchenStatus;
        order.KitchenStatus = nextStatus;
        SetKitchenStatusAudit(order, previousStatus, nextStatus, changedByUserId, utcNow);
    }

    private static void SetPaymentStatus(Order order, PaymentStatus nextStatus, int changedByUserId, DateTime utcNow)
    {
        if (order.PaymentStatus == nextStatus)
        {
            return;
        }

        if (order.PaymentStatus == PaymentStatus.Refunded)
        {
            throw new ApiException("Refunded orders cannot receive payment status changes.", StatusCodes.Status409Conflict);
        }

        var previousStatus = order.PaymentStatus;
        order.PaymentStatus = nextStatus;
        SetPaymentStatusAudit(order, previousStatus, nextStatus, changedByUserId, utcNow);
    }

    private static void SetOrderStatusAudit(Order order, OrderStatus? previousStatus, OrderStatus nextStatus, int changedByUserId, DateTime utcNow)
    {
        order.OrderStatusChangedAt = utcNow;
        order.OrderStatusChangedByUserId = changedByUserId;
        AddStatusChange(order, OrderStatusChangeType.Order, previousStatus?.ToString(), nextStatus.ToString(), changedByUserId, utcNow);
    }

    private static void SetKitchenStatusAudit(Order order, KitchenStatus? previousStatus, KitchenStatus nextStatus, int changedByUserId, DateTime utcNow)
    {
        order.KitchenStatusChangedAt = utcNow;
        order.KitchenStatusChangedByUserId = changedByUserId;
        AddStatusChange(order, OrderStatusChangeType.Kitchen, previousStatus?.ToString(), nextStatus.ToString(), changedByUserId, utcNow);
    }

    private static void SetPaymentStatusAudit(Order order, PaymentStatus? previousStatus, PaymentStatus nextStatus, int changedByUserId, DateTime utcNow)
    {
        order.PaymentStatusChangedAt = utcNow;
        order.PaymentStatusChangedByUserId = changedByUserId;
        AddStatusChange(order, OrderStatusChangeType.Payment, previousStatus?.ToString(), nextStatus.ToString(), changedByUserId, utcNow);
    }

    private static void AddStatusChange(
        Order order,
        OrderStatusChangeType changeType,
        string? fromValue,
        string toValue,
        int changedByUserId,
        DateTime utcNow)
    {
        order.StatusChanges.Add(new OrderStatusChange
        {
            ChangeType = changeType,
            FromValue = fromValue,
            ToValue = toValue,
            ChangedAt = utcNow,
            ChangedByUserId = changedByUserId
        });
    }

    private static PaymentStatus PaymentStatusFor(decimal totalAmount, decimal paidAmount)
    {
        var paid = NormalizeMoney(paidAmount);
        if (paid <= 0)
        {
            return PaymentStatus.Unpaid;
        }

        return paid >= NormalizeMoney(totalAmount) ? PaymentStatus.Paid : PaymentStatus.Partial;
    }

    private static decimal NormalizeMoney(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static bool HasStoredPayments(Order order) =>
        order.Payments.Any(payment => NormalizeMoney(payment.Amount) > 0);
}
