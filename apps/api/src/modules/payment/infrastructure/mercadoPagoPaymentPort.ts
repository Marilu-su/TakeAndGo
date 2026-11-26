import { DomainError } from '../../../shared/domain/DomainError';
import type {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentPort,
} from '../domain/paymentPort';
import { checkoutReturnUrl } from './checkoutReturnUrl';

const MERCADOPAGO_API_URL = 'https://api.mercadopago.com';
const REQUEST_TIMEOUT_MS = 10_000;

export interface MercadoPagoConfig {
  accessToken?: string;
  frontendUrl: string;
  // URL pública de la API; si no es https, no se pide webhook (por ejemplo, en local).
  publicApiUrl?: string;
  // true: usa el link del sandbox (credenciales de prueba).
  useSandboxUrl: boolean;
  fetch?: typeof fetch;
  now?: () => Date;
}

type PreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

/** Fecha en el formato de Mercado Pago, en hora de Argentina (UTC-3). */
export function toMercadoPagoDate(date: Date): string {
  const argentina = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return argentina.toISOString().replace('Z', '-03:00');
}

function isHttps(url: string | undefined): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

function providerError(message: string): DomainError {
  return new DomainError('PAYMENT_PROVIDER_ERROR', message);
}

/**
 * Checkout Pro de Mercado Pago con la API de Preferences.
 * Crea una preferencia por pago: monto del pedido, vencimiento igual a la reserva
 * y referencia externa igual al id del pago, para reconocerlo después.
 */
export class MercadoPagoPaymentPort implements PaymentPort {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly config: MercadoPagoConfig) {
    this.fetchFn = config.fetch ?? fetch;
    this.now = config.now ?? (() => new Date());
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    if (!this.config.accessToken) {
      throw providerError('El proveedor de pagos no está configurado');
    }

    const returnUrl = checkoutReturnUrl(this.config.frontendUrl, input.orderId);

    const body: Record<string, unknown> = {
      items: [
        {
          id: input.orderId,
          title: 'Pedido Take&Go',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: input.amountCents / 100,
        },
      ],
      external_reference: input.paymentId,
      back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
      // Solo medios de pago inmediatos: un pago en efectivo tardaría más que la reserva.
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
        installments: 1,
      },
      expires: true,
      expiration_date_from: toMercadoPagoDate(this.now()),
      expiration_date_to: toMercadoPagoDate(input.expiresAt),
    };

    // Mercado Pago solo acepta volver automáticamente a una URL pública.
    if (isHttps(this.config.frontendUrl)) {
      body.auto_return = 'approved';
    }

    if (isHttps(this.config.publicApiUrl)) {
      const apiUrl = this.config.publicApiUrl.replace(/\/+$/, '');
      body.notification_url = `${apiUrl}/api/v1/payments/webhooks/mercadopago`;
    }

    let response: Response;

    try {
      response = await this.fetchFn(`${MERCADOPAGO_API_URL}/checkout/preferences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': input.paymentId,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      console.error('[Pagos] Mercado Pago no respondió:', error);
      throw providerError('Mercado Pago no respondió. Probá de nuevo.');
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[Pagos] Mercado Pago respondió ${response.status}:`, detail);
      throw providerError('Mercado Pago rechazó la creación del pago. Probá de nuevo.');
    }

    const preference = (await response.json()) as PreferenceResponse;
    const checkoutUrl = this.config.useSandboxUrl
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point;

    if (!preference.id || !checkoutUrl) {
      throw providerError('Mercado Pago devolvió una respuesta incompleta');
    }

    return { providerPreferenceId: preference.id, checkoutUrl };
  }
}
