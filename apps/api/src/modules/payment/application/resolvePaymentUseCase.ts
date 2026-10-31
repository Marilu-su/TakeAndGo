
import {
  canTransitionPayment,
  type Payment,
} from '../domain/payment';

import type { PaymentRepository } from '../domain/paymentRepository';

export class ResolvePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    paymentId: string,
    newStatus: 'APPROVED' | 'REJECTED',
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    if (payment.status === newStatus) {
      return payment;
    }

    if (!canTransitionPayment(payment.status, newStatus)) {
      throw new Error('Transición de pago inválida');
    }

    if (
      newStatus === 'APPROVED' &&
      this.now().getTime() >= payment.expiresAt.getTime()
    ) {
      throw new Error('PAYMENT_EXPIRED');
    }

    const updated = await this.paymentRepository.transitionStatus(
      payment.id,
      payment.status,
      newStatus,
    );

    if (!updated) {
      throw new Error('PAYMENT_STATE_CONFLICT');
    }

    return updated;
  }
}
