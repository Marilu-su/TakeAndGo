
import type { Payment } from '../../src/modules/payment/domain/payment';
import type {
  PaymentRepository,
  CreatePaymentInput,
} from '../../src/modules/payment/domain/paymentRepository';

export class FakePaymentRepository implements PaymentRepository {
  private payments: Payment[] = [];

  async create(input: CreatePaymentInput): Promise<Payment> {
    const payment: Payment = {
      id: `payment-${this.payments.length + 1}`,
      orderId: input.orderId,
      amountCents: input.amountCents,
      expiresAt: input.expiresAt,
      status: 'PENDING',
      providerPaymentId: input.providerPaymentId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.payments.push(payment);
    return payment;
  }

  async findById(id: string): Promise<Payment | null> {
    return this.payments.find((p) => p.id === id) ?? null;
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.payments.find((p) => p.orderId === orderId) ?? null;
  }

  
async updateProviderPaymentId(
  id: string,
  providerPaymentId: string,
): Promise<Payment> {
  const payment = await this.findById(id);

  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  payment.providerPaymentId = providerPaymentId;
  payment.updatedAt = new Date();

  return payment;
}

async transitionStatus(
  id: string,
  expectedStatus: Payment['status'],
  newStatus: Payment['status'],
): Promise<Payment | null> {
  const payment = this.payments.find((p) => p.id === id);

  if (!payment || payment.status !== expectedStatus) {
    return null;
  }

  payment.status = newStatus;
  payment.updatedAt = new Date();

  return payment;
}

}

