using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IPaymentsService
{
    Task<CreatePaymentResponseDto> CreateAsync(int createdByUserId, CreatePaymentDto dto, CancellationToken cancellationToken);
    Task<CreatePaymentRefundResponseDto> RefundAsync(int performedByUserId, CreatePaymentRefundDto dto, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<PaymentResponseDto>> GetAllAsync(DateOnly? date, DateTimeOffset? from, DateTimeOffset? to, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<PaymentResponseDto>> GetByOrderAsync(int orderId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<PaymentRefundResponseDto>> GetRefundsByOrderAsync(int orderId, CancellationToken cancellationToken);
}
