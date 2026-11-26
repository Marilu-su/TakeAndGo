import type {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentPort,
} from '../domain/paymentPort';
import { checkoutReturnUrl } from './checkoutReturnUrl';

/**
 * Proveedor simulado para desarrollo (PAYMENT_PROVIDER=fake).
 * No llama a Mercado Pago: el "checkout" vuelve directo a la web.
 * Nunca se usa en producción.
 */
export class FakeCheckoutPaymentPort implements PaymentPort {
  constructor(private readonly frontendUrl: string) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      providerPreferenceId: `fake-pref-${input.paymentId}`,
      checkoutUrl: checkoutReturnUrl(this.frontendUrl, input.orderId),
    };
  }
}
