
import type { PaymentRepository } from '../domain/paymentRepository';
import type { OrderRepository } from '../../order/domain/orderRepository';
import type { PaymentRefundPort } from '../domain/paymentRefundPort';

export interface PaymentCompensationRepository {
  tryCreatePending(paymentId: string): Promise<boolean>;
  findByPaymentId(paymentId: string): Promise<{
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  providerRefundId: string | null;
  updatedAt?: Date;
} | null>;

  markCompleted(
    paymentId: string,
    providerRefundId: string,
  ): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
  }>;
}

// Una compensación pendiente hace más de este tiempo quedó trabada por un error
// del proveedor y se reintenta. El reembolso usa una clave de idempotencia,
// así que reintentar nunca devuelve el dinero dos veces.
export const STALE_COMPENSATION_MS = 60_000;

export class ProcessLatePaymentCompensationUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
    private readonly compensationRepository: PaymentCompensationRepository,
    private readonly refundPort: PaymentRefundPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(paymentId: string): Promise<void> {
    if (!paymentId.trim()) {
      throw new Error('PAYMENT_ID_REQUIRED');
    }

    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new Error('PAYMENT_NOT_FOUND');
    }

    const order = await this.orderRepository.findById(
      payment.orderId,
    );

    if (!order || order.status !== 'EXPIRED') {
      throw new Error('ORDER_NOT_EXPIRED');
    }

    if (!payment.providerPaymentId) {
      throw new Error('PROVIDER_PAYMENT_ID_REQUIRED');
    }

    if (
      payment.status !== 'PENDING' &&
      payment.status !== 'APPROVED' &&
      payment.status !== 'REFUNDED'
    ) {
      throw new Error('PAYMENT_STATE_CONFLICT');
    }

    const created =
      await this.compensationRepository.tryCreatePending(paymentId);

    if (!created) {
  const existing =
    await this.compensationRepository.findByPaymentId(paymentId);

  if (existing?.status === 'COMPLETED') {
    return;
  }

  const stale =
    existing?.status === 'PENDING' &&
    existing.updatedAt !== undefined &&
    this.now().getTime() - existing.updatedAt.getTime() >= STALE_COMPENSATION_MS;

  if (!stale) {
    throw new Error('COMPENSATION_ALREADY_EXISTS');
  }
}

    const refund = await this.refundPort.refundPayment({
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId,
      amountCents: payment.amountCents,
    });

    if (!refund.providerRefundId) {
      throw new Error('REFUND_NOT_CONFIRMED');
    }

    await this.compensationRepository.markCompleted(
      payment.id,
      refund.providerRefundId,
    );
  }
}
