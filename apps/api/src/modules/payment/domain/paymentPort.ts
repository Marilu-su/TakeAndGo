
export interface CreatePaymentIntentInput {
  paymentId: string;
  amountCents: number;
  expiresAt: Date;
}

export interface PaymentIntentResult {
  providerPaymentId: string;
}

export interface PaymentPort {
  createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult>;
}
