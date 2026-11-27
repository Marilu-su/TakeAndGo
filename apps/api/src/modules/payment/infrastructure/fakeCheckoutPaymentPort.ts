import type {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentPort,
} from '../domain/paymentPort';
import type { PaymentStatusPort, ProviderPayment } from '../domain/paymentStatusPort';
import { checkoutReturnUrl } from './checkoutReturnUrl';

/**
 * Proveedor simulado para desarrollo (PAYMENT_PROVIDER=fake).
 * No llama a Mercado Pago: el "checkout" vuelve directo a la web
 * y el pago se aprueba en cuanto se consulta su estado.
 * Nunca se usa en producción.
 */
export class FakeCheckoutPaymentPort implements PaymentPort, PaymentStatusPort {
  constructor(private readonly frontendUrl: string) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      providerPreferenceId: `fake-pref-${input.paymentId}`,
      checkoutUrl: checkoutReturnUrl(this.frontendUrl, input.orderId),
    };
  }

  async findPaymentByReference(payment: { id: string; amountCents: number }): Promise<ProviderPayment> {
    return {
      providerPaymentId: `fake-pay-${payment.id}`,
      externalReference: payment.id,
      status: 'APPROVED',
      amountCents: payment.amountCents,
    };
  }

  // El simulador no envía avisos.
  async getPayment(): Promise<ProviderPayment | null> {
    return null;
  }
}
