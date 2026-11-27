import { ApiError } from './api';
import { sessionRequest } from './session';

export type CheckoutState = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
export type CheckoutOrderStatus =
  | 'RESERVED' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

type CheckoutPayment = {
  paymentId: string;
  orderId: string;
  amountCents: number;
  expiresAt: string;
};

export type StartCheckoutResponse = CheckoutPayment & {
  status: 'PENDING';
  checkoutUrl: string;
};

export type CheckoutStatusResponse = CheckoutPayment & {
  paymentStatus: PaymentStatus;
  orderStatus: CheckoutOrderStatus;
  checkoutState: CheckoutState;
};

function paymentPath(orderId: string) {
  return `/api/v1/orders/${encodeURIComponent(orderId)}/payment`;
}

export function startCheckout(orderId: string) {
  return sessionRequest<StartCheckoutResponse>(paymentPath(orderId), { method: 'POST' });
}

export function getCheckoutStatus(orderId: string) {
  return sessionRequest<CheckoutStatusResponse>(paymentPath(orderId), { method: 'GET' });
}

export function isCheckoutReturn(pago: string | string[] | undefined): boolean {
  return pago === 'retorno';
}

export function isSafeCheckoutUrl(value: unknown, origin: string): value is string {
  if (typeof value !== 'string' || !value || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) return false;

  try {
    const url = new URL(value, origin);
    if (url.username || url.password) return false;
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === origin);
  } catch {
    return false;
  }
}

export function shouldPollCheckout(state: CheckoutState): boolean {
  return state === 'PENDING';
}

export function isTerminalCheckoutState(state: CheckoutState): boolean {
  return !shouldPollCheckout(state);
}

export function checkoutSecondsRemaining(expiresAt: string, now = Date.now()): number {
  const remaining = Date.parse(expiresAt) - now;
  return Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining / 1000)) : 0;
}

export function canStartCheckout(
  order: { status: string; reservedUntil: string | null },
  now = Date.now(),
): boolean {
  return order.status === 'RESERVED' && order.reservedUntil !== null &&
    checkoutSecondsRemaining(order.reservedUntil, now) > 0;
}

export function formatCheckoutTime(seconds: number): string {
  const wholeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(wholeSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

const checkoutMessages: Record<CheckoutState, string> = {
  PENDING: 'Esperando confirmación del pago',
  CONFIRMED: 'Pago aprobado. Tu pedido está confirmado',
  REJECTED: 'El pago fue rechazado',
  EXPIRED: 'Se venció el tiempo para pagar',
  CANCELLED: 'Cancelaste el pedido',
};

export function checkoutMessage(state: CheckoutState): string {
  return checkoutMessages[state];
}

export function checkoutPresentation(
  order: { status: string; reservedUntil: string | null },
  checkoutState?: CheckoutState,
  now = Date.now(),
  allowPaymentStart = true,
) {
  const state = checkoutState ?? (order.status === 'CANCELLED' || order.status === 'EXPIRED' ? order.status : undefined);
  const terminal = state !== undefined && isTerminalCheckoutState(state);
  const historicalPickup = order.status === 'CANCELLED' || order.status === 'EXPIRED' ||
    state === 'CANCELLED' || state === 'REJECTED' || state === 'EXPIRED';

  return {
    state,
    canPay: allowPaymentStart && !state && canStartCheckout(order, now),
    canCancel: order.status === 'RESERVED' && !terminal,
    canCheck: !terminal,
    canReturnToCatalog: state === 'REJECTED' || state === 'EXPIRED',
    historicalPickup,
  };
}

const checkoutErrorCodes = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'ORDER_NOT_FOUND',
  'PAYMENT_NOT_FOUND',
  'ORDER_NOT_PAYABLE',
  'RESERVATION_EXPIRED',
  'PAYMENT_PROVIDER_ERROR',
] as const;

export type CheckoutErrorCode = typeof checkoutErrorCodes[number];

export function checkoutErrorCode(error: unknown): CheckoutErrorCode | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return checkoutErrorCodes.find(code => code === error.code);
}

export function checkoutFailure(error: unknown, phase: 'start' | 'status') {
  const code = checkoutErrorCode(error);
  const status = error instanceof ApiError ? error.status : undefined;
  if (code === 'UNAUTHENTICATED' || status === 401) {
    return { message: 'Tu sesión no está disponible. Volvé a ingresar.', retry: false, refreshOrder: false };
  }
  if (code === 'FORBIDDEN' || status === 403) {
    return { message: 'No tenés permiso para acceder al pago de este pedido.', retry: false, refreshOrder: false };
  }
  switch (code) {
    case 'ORDER_NOT_FOUND':
      return { message: 'No encontramos este pedido.', retry: false, refreshOrder: true };
    case 'PAYMENT_NOT_FOUND':
      return { message: 'Todavía no hay un pago iniciado para este pedido.', retry: true, refreshOrder: true, paymentNotFound: true };
    case 'ORDER_NOT_PAYABLE':
      return { message: 'El pedido ya no admite pago.', retry: false, refreshOrder: true };
    case 'RESERVATION_EXPIRED':
      return { message: 'Se venció el tiempo para pagar el pedido.', retry: false, refreshOrder: true };
    case 'PAYMENT_PROVIDER_ERROR':
      return {
        message: phase === 'start' ? 'El servicio de pago no pudo iniciar el checkout. Probá de nuevo.'
          : 'El servicio de pago no está disponible. Volvé a consultar.',
        retry: true,
        refreshOrder: false,
      };
    default:
      return {
        message: phase === 'start' ? 'No se pudo verificar el inicio del pago. Podés reintentar.'
          : 'No se pudo consultar el pago. Podés volver a consultar.',
        retry: true,
        refreshOrder: false,
      };
  }
}
