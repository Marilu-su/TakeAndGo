import { DomainError } from '../../../shared/domain/DomainError';
import type {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentPort,
} from '../domain/paymentPort';
import type {
  PaymentRefundPort,
  RefundPaymentInput,
  RefundPaymentResult,
} from '../domain/paymentRefundPort';
import type {
  PaymentStatusPort,
  ProviderPayment,
  ProviderPaymentStatus,
} from '../domain/paymentStatusPort';
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

type MercadoPagoPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
};

/** Traduce el estado de Mercado Pago a los resultados que entiende nuestro sistema. */
export function toProviderStatus(status: string | undefined): ProviderPaymentStatus {
  if (status === 'approved') return 'APPROVED';
  if (status === 'rejected' || status === 'cancelled') return 'REJECTED';
  // pending, in_process, authorized, etc.: todavía no hay resultado definitivo.
  return 'PENDING';
}

function toProviderPayment(raw: MercadoPagoPayment): ProviderPayment | null {
  if (raw.id === undefined || raw.id === null) {
    return null;
  }

  return {
    providerPaymentId: String(raw.id),
    externalReference: raw.external_reference ?? null,
    status: toProviderStatus(raw.status),
    amountCents: Math.round(Number(raw.transaction_amount ?? 0) * 100),
  };
}

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
export class MercadoPagoPaymentPort implements PaymentPort, PaymentStatusPort, PaymentRefundPort {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly config: MercadoPagoConfig) {
    this.fetchFn = config.fetch ?? fetch;
    this.now = config.now ?? (() => new Date());
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
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

    const response = await this.request('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': input.paymentId },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await this.logFailure(response);
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

  async getPayment(providerPaymentId: string): Promise<ProviderPayment | null> {
    const response = await this.request(`/v1/payments/${encodeURIComponent(providerPaymentId)}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      await this.logFailure(response);
      throw providerError('No se pudo consultar el pago en Mercado Pago');
    }

    return toProviderPayment((await response.json()) as MercadoPagoPayment);
  }

  async findPaymentByReference(payment: { id: string }): Promise<ProviderPayment | null> {
    const paymentId = payment.id;
    const query = new URLSearchParams({
      external_reference: paymentId,
      sort: 'date_created',
      criteria: 'desc',
    });

    const response = await this.request(`/v1/payments/search?${query.toString()}`);

    if (!response.ok) {
      await this.logFailure(response);
      throw providerError('No se pudo consultar el pago en Mercado Pago');
    }

    const { results = [] } = (await response.json()) as { results?: MercadoPagoPayment[] };
    const payments = results
      .map(toProviderPayment)
      .filter((found): found is ProviderPayment => found !== null && found.externalReference === paymentId);

    // Un mismo checkout puede tener varios intentos (por ejemplo, un rechazo y después una aprobación).
    return (
      payments.find(found => found.status === 'APPROVED') ??
      payments.find(found => found.status === 'PENDING') ??
      payments[0] ??
      null
    );
  }

  /** Reembolso total de un pago aprobado tarde (MVP-08). */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const response = await this.request(`/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refunds`, {
      method: 'POST',
      // Misma clave en cada reintento: Mercado Pago no reembolsa dos veces.
      headers: { 'X-Idempotency-Key': `refund-${input.paymentId}` },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      await this.logFailure(response);
      throw providerError('Mercado Pago no pudo reembolsar el pago');
    }

    const refund = (await response.json()) as { id?: number | string };

    if (refund.id === undefined || refund.id === null) {
      throw providerError('Mercado Pago no confirmó el reembolso');
    }

    return { providerRefundId: String(refund.id) };
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.config.accessToken) {
      throw providerError('El proveedor de pagos no está configurado');
    }

    try {
      return await this.fetchFn(`${MERCADOPAGO_API_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      console.error('[Pagos] Mercado Pago no respondió:', error);
      throw providerError('Mercado Pago no respondió. Probá de nuevo.');
    }
  }

  private async logFailure(response: Response): Promise<void> {
    const detail = await response.text().catch(() => '');
    console.error(`[Pagos] Mercado Pago respondió ${response.status}:`, detail);
  }
}
