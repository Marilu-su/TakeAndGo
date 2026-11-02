
import type { PaymentRepository } from '../domain/paymentRepository';
import type { OrderRepository } from '../../order/domain/orderRepository';
import type { PaymentRefundPort } from '../domain/paymentRefundPort';

export interface PaymentCompensationRepository {
  tryCreatePending(paymentId: string): Promise<boolean>;
  findByPaymentId(paymentId: string): Promise<{
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  providerRefundId: string | null;
} | null>;

  markCompleted(
    paymentId: string,
    providerRefundId: string,
  ): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
  }>;
}

export class ProcessLatePaymentCompensationUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
    private readonly compensationRepository: PaymentCompensationRepository,
    private readonly refundPort: PaymentRefundPort,
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

  throw new Error('COMPENSATION_ALREADY_EXISTS');
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
