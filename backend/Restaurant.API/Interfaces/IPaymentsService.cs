using Restaurant.API.DTOs;

namespace Restaurant.API.Interfaces;

public interface IPaymentsService
{
    Task<PaymentResponseDto> CreateAsync(CreatePaymentDto dto, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<PaymentResponseDto>> GetByOrderAsync(int orderId, CancellationToken cancellationToken);
}
