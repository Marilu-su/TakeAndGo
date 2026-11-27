'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import { ApiError } from '@/lib/api';
import {
  canStartCheckout, checkoutFailure, checkoutPresentation, checkoutSecondsRemaining, getCheckoutStatus,
  isSafeCheckoutUrl, isTerminalCheckoutState, startCheckout, type CheckoutStatusResponse,
} from '@/lib/checkout';
import { startCheckoutPolling } from '@/lib/checkout-polling';
import { money, orderStatus, type Order } from '@/lib/types';
import { OrderCheckout } from './order-checkout';
import { ResourceState } from './resource-state';
import { formatPickupDateTime, orderPickupSummary } from '@/lib/pickup-windows';
import QRCode from 'react-qr-code';
const date = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
export function OrdersList() {
  const resource = useResource<Order[]>('/api/v1/orders');
  return <main className="page"><h1>Mis pedidos</h1><div className="actions"><Link href="/buffets">Explorar buffets</Link><button className="secondary" disabled={resource.loading} onClick={resource.reload}>Actualizar pedidos</button></div><ResourceState {...resource} retry={resource.reload} />
    {resource.data?.length === 0 && <section className="panel"><h2>Todavía no hiciste pedidos</h2><p>Elegí un buffet y agregá productos a tu carrito.</p></section>}
    <div className="cards">{resource.data?.map(order => <article key={order.id} className="panel form-stack"><h2>Pedido #{order.orderNumber}</h2><p>{date(order.createdAt)}</p><p>{orderStatus[order.status] || order.status}</p><p className="price">{money(order.totalCents)}</p><Link className="button" href={`/pedidos/${encodeURIComponent(order.id)}`}>Ver detalle</Link></article>)}</div>
  </main>;
}
type OrderAction = 'checkout' | 'check-payment' | 'confirm-cancel' | 'cancel' | 'pickup';

type OrderDetailProps = { id: string; returnedFromCheckout: boolean };

export function OrderDetail({ id, returnedFromCheckout }: OrderDetailProps) {
  return <OrderDetailForId key={id} id={id} returnedFromCheckout={returnedFromCheckout} />;
}

function OrderDetailForId({ id, returnedFromCheckout }: OrderDetailProps) {
  const resource = useResource<Order>(`/api/v1/orders/${encodeURIComponent(id)}`);
  const actionRef = useRef<OrderAction | null>(null);
  const [action, setAction] = useState<OrderAction | null>(null);
  const active = useRef(false);
  const [lastOrder, setLastOrder] = useState<Order>();
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatusResponse>();
  const [checkoutError, setCheckoutError] = useState<ReturnType<typeof checkoutFailure>>();
  const [startError, setStartError] = useState<ReturnType<typeof checkoutFailure>>();
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const refreshedDeadline = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pickup, setPickup] = useState<{ type: 'QR'; token: string; expiresAt: string } | { type: 'MANUAL'; code: string }>();
  const reload = resource.reload;
  const order = resource.data ?? lastOrder;
  if (resource.data && resource.data !== lastOrder) setLastOrder(resource.data);
  const unavailable = resource.loading || !!resource.error;
  const busy = action !== null || unavailable;
  const verifyPayment = returnedFromCheckout || checkAttempt > 0;
  const allowPaymentStart = !verifyPayment || checkoutError?.paymentNotFound === true;
  const presentation = order && checkoutPresentation(order, checkoutStatus?.checkoutState, now, allowPaymentStart);
  const deadline = checkoutStatus
    ? checkoutStatus.checkoutState === 'PENDING' ? checkoutStatus.expiresAt : null
    : order?.status === 'RESERVED' ? order.reservedUntil : null;
  const secondsLeft = deadline ? checkoutSecondsRemaining(deadline, now) : null;

  const changeAction = useCallback((next: OrderAction | null, previous: OrderAction | null = null) => {
    if (actionRef.current !== previous) return false;
    actionRef.current = next;
    setAction(next);
    return true;
  }, []);

  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    function resume(event: PageTransitionEvent) {
      if (event.persisted && actionRef.current === 'checkout') {
        actionRef.current = null;
        setAction(null);
        reload();
      }
    }
    const interval = setInterval(() => {
      if (!actionRef.current && document.visibilityState === 'visible') reload();
    }, 30000);
    window.addEventListener('pageshow', resume);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pageshow', resume);
    };
  }, [reload]);

  useEffect(() => {
    if (!verifyPayment) return;
    return startCheckoutPolling({
      request: async () => {
        if (!active.current || document.visibilityState === 'hidden' || !changeAction('check-payment')) return;
        try {
          return await getCheckoutStatus(id);
        } finally {
          if (active.current) changeAction(null, 'check-payment');
        }
      },
      onStatus: status => {
        if (!active.current) return;
        setCheckoutStatus(status);
        setCheckoutError(undefined);
        setStartError(undefined);
        if (isTerminalCheckoutState(status.checkoutState)) reload();
      },
      onError: cause => {
        if (!active.current) return;
        const failure = checkoutFailure(cause, 'status');
        setCheckoutError(failure);
        if (failure.refreshOrder) reload();
      },
    });
  }, [id, verifyPayment, checkAttempt, changeAction, reload]);

  const countdownRunning = secondsLeft !== null && secondsLeft > 0;
  useEffect(() => {
    if (!deadline || !countdownRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline, countdownRunning]);

  useEffect(() => {
    if (!deadline || secondsLeft !== 0 || action || verifyPayment || refreshedDeadline.current === deadline) return;
    refreshedDeadline.current = deadline;
    reload();
  }, [deadline, secondsLeft, action, verifyPayment, reload]);

  function checkPayment() {
    if (actionRef.current || !presentation?.canCheck || checkoutError?.retry === false) return;
    setCheckoutError(undefined);
    setCheckAttempt(attempt => attempt + 1);
  }

  async function pay() {
    if (!order || !allowPaymentStart || presentation?.state || startError?.retry === false ||
        checkoutError?.retry === false || unavailable || !changeAction('checkout')) return;
    setError('');
    setMessage('');
    setStartError(undefined);
    setCheckoutError(undefined);
    let navigating = false;
    try {
      if (!canStartCheckout(order)) {
        setStartError({ message: 'Se venció el tiempo para iniciar el pago. Estamos actualizando el pedido.', retry: false, refreshOrder: true });
        reload();
        return;
      }
      const { checkoutUrl } = await startCheckout(order.id);
      if (!active.current) return;
      if (!isSafeCheckoutUrl(checkoutUrl, window.location.origin)) {
        setStartError({ message: 'El servicio devolvió un enlace de pago inválido. Probá de nuevo.', retry: true, refreshOrder: false });
        return;
      }
      window.location.assign(checkoutUrl);
      navigating = true;
    } catch (cause) {
      if (!active.current) return;
      const failure = checkoutFailure(cause, 'start');
      setStartError(failure);
      if (failure.refreshOrder) reload();
    } finally {
      if (active.current && !navigating) changeAction(null, 'checkout');
    }
  }

  async function cancel() {
    if (unavailable || !presentation?.canCancel || !changeAction('cancel', 'confirm-cancel')) return;
    setError('');
    let cancelled = false;
    try {
      await sessionRequest(`/api/v1/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      if (!active.current) return;
      cancelled = true;
      setMessage('Reserva cancelada.');
      reload();
      if (verifyPayment) setCheckAttempt(attempt => attempt + 1);
    } catch (cause) {
      if (active.current) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cancelar.');
        if (cause instanceof ApiError && cause.status === 409) {
          cancelled = true; // Close the confirmation while reconciling the order.
          reload();
          if (verifyPayment) setCheckAttempt(attempt => attempt + 1);
        }
      }
    } finally {
      if (active.current) changeAction(cancelled ? null : 'confirm-cancel', 'cancel');
    }
  }
  async function issuePickup(type: 'QR' | 'MANUAL') {
    if (unavailable || !changeAction('pickup')) return;
    setError(''); setMessage(''); setPickup(undefined);
    try {
      const result = await sessionRequest<{ token: string; expiresAt: string } | { code: string }>(`/api/v1/orders/${encodeURIComponent(id)}/pickup/${type === 'QR' ? 'qr' : 'manual'}`, { method: 'POST' });
      if (active.current) setPickup(type === 'QR' ? { type, ...(result as { token: string; expiresAt: string }) } : { type, ...(result as { code: string }) });
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'No se pudo generar la credencial de retiro.');
    } finally {
      if (active.current) changeAction(null, 'pickup');
    }
  }
  const pickupSummary = order && orderPickupSummary(order);
  return <main className="page"><Link href="/pedidos">← Mis pedidos</Link><h1>Detalle del pedido</h1><button className="secondary" disabled={action !== null || resource.loading} onClick={resource.reload}>Actualizar estado</button><ResourceState {...resource} retry={resource.reload} />
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {order && <section className="panel form-stack"><h2>Pedido #{order.orderNumber}</h2><p role="status">Estado: {orderStatus[order.status] || order.status}</p><p>Creado: {date(order.createdAt)}</p>
      {deadline && <p>Tiempo para pagar hasta: {formatPickupDateTime(deadline)} (hora de Buenos Aires). La API confirma su estado al actualizar.</p>}
      {pickupSummary && <div>
        <p>{presentation?.historicalPickup ? 'Ventana de retiro original' : 'Ventana de retiro'}: {pickupSummary.window} (hora de Buenos Aires).</p>
        {pickupSummary.tolerance && <p>{presentation?.historicalPickup ? 'Tolerancia original' : 'Tolerancia'} hasta las {pickupSummary.tolerance}.</p>}
      </div>}
      {order.items.map((item, index) => <article className="panel" key={index}><h3>{item.quantity} × {item.productNameSnapshot}</h3>{item.additions.map((a, i) => <p key={i}>+ {a.additionNameSnapshot}</p>)}<p>{money(item.subtotalCents)}</p></article>)}
      <p className="price">Total: {money(order.totalCents)}</p>
      <OrderCheckout disabled={busy} starting={action === 'checkout'} checking={action === 'check-payment'}
        canPay={!!presentation?.canPay && startError?.retry !== false && checkoutError?.retry !== false}
        canCheck={!!presentation?.canCheck && checkoutError?.retry !== false} polling={verifyPayment && !checkoutError}
        secondsLeft={secondsLeft}
        state={presentation?.state} orderStillReserved={order.status === 'RESERVED'}
        catalogHref={presentation?.canReturnToCatalog ? `/buffets/${encodeURIComponent(order.storeId)}/catalogo` : undefined}
        error={checkoutError?.message ?? startError?.message ?? ''} onPay={pay} onCheck={checkPayment} />
      {order.status === 'READY_FOR_PICKUP' && <section className="panel form-stack"><h2>Retirá tu pedido</h2><p>Mostrá el QR al personal o generá un código manual.</p><div className="actions"><button disabled={busy} onClick={() => void issuePickup('QR')}>Generar QR</button><button className="secondary" disabled={busy} onClick={() => void issuePickup('MANUAL')}>Generar código manual</button></div>{pickup?.type === 'QR' && <div className="form-stack"><div className="bg-white p-4" aria-label="Código QR de retiro"><QRCode value={JSON.stringify({ orderId: id, token: pickup.token })} size={208} /></div><p>Vence: {date(pickup.expiresAt)}. Generá otro si vence.</p></div>}{pickup?.type === 'MANUAL' && <p className="price" aria-label="Código manual de retiro">{pickup.code}</p>}</section>}
      {presentation?.canCancel && <button className="secondary" disabled={busy} onClick={() => changeAction('confirm-cancel')}>Cancelar reserva</button>}
      {(action === 'confirm-cancel' || action === 'cancel') && (presentation?.canCancel || action === 'confirm-cancel') && <div role="alertdialog" aria-label="Confirmar cancelación" className="form-stack"><p>¿Cancelar esta reserva y liberar su stock?</p><div className="actions"><button disabled={action === 'cancel' || unavailable || !presentation?.canCancel} onClick={cancel}>Confirmar cancelación</button><button className="secondary" disabled={action === 'cancel'} onClick={() => changeAction(null, 'confirm-cancel')}>Conservar pedido</button></div></div>}
    </section>}
  </main>;
}
