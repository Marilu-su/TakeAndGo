'use client';

import Link from 'next/link';
import { checkoutMessage, formatCheckoutTime, type CheckoutState } from '@/lib/checkout';

type OrderCheckoutProps = {
  disabled: boolean;
  starting: boolean;
  checking: boolean;
  canPay: boolean;
  canCheck: boolean;
  polling: boolean;
  secondsLeft: number | null;
  state?: CheckoutState;
  catalogHref?: string;
  orderStillReserved: boolean;
  error: string;
  onPay: () => void;
  onCheck: () => void;
};

export function OrderCheckout({
  disabled, starting, checking, canPay, canCheck, polling, secondsLeft, state, catalogHref,
  orderStillReserved, error, onPay, onCheck,
}: OrderCheckoutProps) {
  const statusClass = state === 'CONFIRMED' ? 'success' : state === 'REJECTED' ? 'error'
    : state === 'EXPIRED' ? 'panel' : undefined;
  return (
    <div className="form-stack">
      {state && <p role="status" className={statusClass}>{checkoutMessage(state)}</p>}
      {state === 'PENDING' && <p className="muted">
        {polling ? 'Consultamos el estado automáticamente.' : 'La consulta automática está pausada.'} No hagas otro pago.
      </p>}
      {state === 'EXPIRED' && orderStillReserved && <p className="muted">
        El estado del pedido todavía se está actualizando.
      </p>}
      {secondsLeft !== null && <p>
        Tiempo restante para pagar: <span role="timer" aria-live="off">{formatCheckoutTime(secondsLeft)}</span>.
      </p>}
      {secondsLeft === 0 && <p role="status">
        {error
          ? canCheck ? 'El plazo llegó a cero. Volvé a consultar para verificar el resultado.'
            : 'El plazo llegó a cero. El resultado queda pendiente de verificar.'
          : 'El plazo llegó a cero. Estamos verificando el estado con la API.'}
      </p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        {(canPay || starting) && <button type="button" disabled={disabled || starting} aria-busy={starting} onClick={onPay}>
          {starting ? 'Iniciando pago...' : 'Pagar con Mercado Pago'}
        </button>}
        {(canCheck || checking) && <button type="button" className="secondary" disabled={disabled || checking} onClick={onCheck}>
          {checking ? 'Consultando pago...' : 'Consultar estado del pago'}
        </button>}
        {catalogHref && <Link className="button secondary" href={catalogHref}>Volver al catálogo</Link>}
      </div>
    </div>
  );
}
