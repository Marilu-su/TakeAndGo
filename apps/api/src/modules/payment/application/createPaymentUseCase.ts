
import type { Payment } from '../domain/payment';
import type { PaymentRepository } from '../domain/paymentRepository';
import type { PaymentPort } from '../domain/paymentPort';

export class CreatePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentPort: PaymentPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    orderId: string,
    amountCents: number,
    expiresAt: Date,
  ): Promise<Payment> {
    if (!orderId.trim()) {
      throw new Error('El pedido es obligatorio');
    }

    if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
      throw new Error('El monto del pago es inválido');
    }

    if (
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt.getTime() <= this.now().getTime()
    ) {
      throw new Error('La fecha de expiración debe ser futura');
    }

    let payment = await this.paymentRepository.findByOrderId(orderId);

    if (payment) {
      if (
        payment.amountCents !== amountCents ||
        payment.expiresAt.getTime() !== expiresAt.getTime()
      ) {
        throw new Error('PAYMENT_REQUEST_CONFLICT');
      }

      if (payment.status !== 'PENDING') {
        return payment;
      }

      if (payment.providerPaymentId) {
        return payment;
      }
    
} else {
  payment = await this.paymentRepository.create({
    orderId,
    amountCents,
    expiresAt,
  });

  if (
    payment.amountCents !== amountCents ||
    payment.expiresAt.getTime() !== expiresAt.getTime()
  ) {
    throw new Error('PAYMENT_REQUEST_CONFLICT');
  }
}


    const intent = await this.paymentPort.createPaymentIntent({
      paymentId: payment.id,
      amountCents: payment.amountCents,
      expiresAt: payment.expiresAt,
    });

    return this.paymentRepository.updateProviderPaymentId(
      payment.id,
      intent.providerPaymentId,
    );
  }
}
