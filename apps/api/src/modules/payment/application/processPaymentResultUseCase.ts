
import type { Payment } from '../domain/payment';

export type PaymentResult = 'APPROVED' | 'REJECTED';

export interface PaymentOrderStockPort {
  applyResult(
    paymentId: string,
    result: PaymentResult,
    now: Date,
  ): Promise<Payment>;
}

export interface LatePaymentCompensationPort {
  execute(paymentId: string): Promise<void>;
}

export class ProcessPaymentResultUseCase {
  constructor(
    private readonly paymentOrderStock: PaymentOrderStockPort,
    private readonly now: () => Date = () => new Date(),
    private readonly compensation?: LatePaymentCompensationPort,
  ) {}

  async execute(
    paymentId: string,
    result: PaymentResult,
  ): Promise<Payment> {
    if (!paymentId.trim()) {
      throw new Error('El pago es obligatorio');
    }

    try {
      return await this.paymentOrderStock.applyResult(
        paymentId,
        result,
        this.now(),
      );
    } catch (error) {
      const isLateApproval =
        result === 'APPROVED' &&
        error instanceof Error &&
        (
          error.message === 'ORDER_NOT_RESERVED' ||
          error.message === 'PAYMENT_EXPIRED'
        );

      if (!isLateApproval || !this.compensation) {
        throw error;
      }

      await this.compensation.execute(paymentId);

      // El pedido no se confirma aunque la compensación se complete.
      throw new Error('LATE_PAYMENT_COMPENSATED');
    }
  }
}
