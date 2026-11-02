
export interface RefundPaymentInput {
  paymentId: string;
  providerPaymentId: string;
  amountCents: number;
}

export interface RefundPaymentResult {
  providerRefundId: string;
}

export interface PaymentRefundPort {
  refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult>;
}
