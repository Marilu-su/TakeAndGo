
export interface CreatePaymentIntentInput {
  paymentId: string;
  orderId: string;
  amountCents: number;
  expiresAt: Date;
}

export interface PaymentIntentResult {
  // Identificador de la preferencia (Checkout Pro) en el proveedor.
  providerPreferenceId: string;
  // Link al que la web redirige al cliente para pagar.
  checkoutUrl: string;
}

export interface PaymentPort {
  createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult>;
}
