
import type { Payment, PaymentStatus } from './payment';

export interface CreatePaymentInput {
  orderId: string;
  amountCents: number;
  expiresAt: Date;
  providerPaymentId?: string | null;
}

export interface PaymentRepository {
  create(input: CreatePaymentInput): Promise<Payment>;

  findById(id: string): Promise<Payment | null>;

  findByOrderId(orderId: string): Promise<Payment | null>;

  updateProviderPaymentId(
    id: string,
    providerPaymentId: string,
  ): Promise<Payment>;

  transitionStatus(
    id: string,
    expectedStatus: PaymentStatus,
    newStatus: PaymentStatus,
  ): Promise<Payment | null>;
}
