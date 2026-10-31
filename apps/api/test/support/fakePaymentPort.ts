
import type {
  PaymentPort,
  CreatePaymentIntentInput,
  PaymentIntentResult,
} from '../../src/modules/payment/domain/paymentPort';

export class FakePaymentPort implements PaymentPort {
  readonly createdIntents: CreatePaymentIntentInput[] = [];

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    this.createdIntents.push(input);

    return {
      providerPaymentId: `fake-${input.paymentId}`,
    };
  }
}
