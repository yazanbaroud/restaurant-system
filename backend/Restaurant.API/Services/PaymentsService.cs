using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Enums;
using Restaurant.API.Helpers;
using Restaurant.API.Hubs;
using Restaurant.API.Interfaces;
using Restaurant.API.Models;

namespace Restaurant.API.Services;

public sealed class PaymentsService(
    AppDbContext db,
    IHubContext<RestaurantHub> hub,
    ILogger<PaymentsService> logger) : IPaymentsService
{
    public async Task<PaymentResponseDto> CreateAsync(CreatePaymentDto dto, CancellationToken cancellationToken)
    {
        var order = await db.Orders.Include(x => x.Payments).SingleOrDefaultAsync(x => x.Id == dto.OrderId, cancellationToken)
            ?? throw new ApiException("Order not found.", StatusCodes.Status404NotFound);

        var payment = new Payment { OrderId = dto.OrderId, Amount = dto.Amount, Method = dto.Method, PaidAt = DateTime.UtcNow };
        order.Payments.Add(payment);
        var totalPaid = order.Payments.Sum(x => x.Amount);
        order.PaymentStatus = totalPaid >= order.TotalPrice ? PaymentStatus.Paid : PaymentStatus.Unpaid;
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Payment {PaymentId} added to order {OrderId}", payment.Id, order.Id);
        var response = payment.ToPaymentResponse();
        await hub.Clients.All.SendAsync("paymentAdded", response, cancellationToken);
        return response;
    }

    public async Task<IReadOnlyCollection<PaymentResponseDto>> GetByOrderAsync(int orderId, CancellationToken cancellationToken)
    {
        if (!await db.Orders.AnyAsync(x => x.Id == orderId, cancellationToken))
        {
            throw new ApiException("Order not found.", StatusCodes.Status404NotFound);
        }

        return await db.Payments.AsNoTracking()
            .Where(x => x.OrderId == orderId)
            .OrderByDescending(x => x.PaidAt)
            .Select(x => x.ToPaymentResponse())
            .ToArrayAsync(cancellationToken);
    }
}
