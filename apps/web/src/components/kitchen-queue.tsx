'use client';

import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useActor } from '@/components/session-shell';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import { ResourceState } from '@/components/resource-state';
import { formatPickupTime } from '@/lib/pickup-windows';

type KitchenOrder = {
  id: string;
  orderNumber: number;
  status: 'CONFIRMED' | 'PREPARING';
  promisedFrom?: string | null;
  preparedAt?: string | null;
  items: { productNameSnapshot: string; quantity: number; additions: { additionNameSnapshot: string; quantity: number }[] }[];
};

export function KitchenQueue() {
  const { storeId = '', userId } = useActor();
  return <StoreKitchenQueue key={JSON.stringify([storeId, userId])} storeId={storeId} />;
}

function StoreKitchenQueue({ storeId }: { storeId: string }) {
  const path = `/api/v1/stores/${encodeURIComponent(storeId)}/kitchen/orders`;
  const resource = useResource<KitchenOrder[]>(path);
  const locked = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [kitchenErrors, setKitchenErrors] = useState<Record<string, string>>({});
  const [credentialInput, setCredentialInput] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [pickupMessage, setPickupMessage] = useState('');
  const [pickupBusy, setPickupBusy] = useState(false);
  const pickupRequest = useRef<symbol | null>(null);
  const refresh = resource.reload;

  useLayoutEffect(() => () => { pickupRequest.current = null; }, []);

  useLayoutEffect(() => {
    // Release after React commits the refreshed queue or the error state.
    for (const id of locked.current) {
      if (!pending.has(id)) locked.current.delete(id);
    }
  }, [pending]);

  async function transition(order: KitchenOrder, action: 'start' | 'finish') {
    if (locked.current.has(order.id)) return;
    locked.current.add(order.id);
    setPending(current => new Set(current).add(order.id));
    setKitchenErrors(current => ({ ...current, [order.id]: '' }));
    try {
      await sessionRequest(`${path}/${encodeURIComponent(order.id)}/${action}`, { method: 'POST' });
      refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo actualizar el pedido.';
      setKitchenErrors(current => ({ ...current, [order.id]: message }));
    } finally {
      setPending(current => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
    }
  }
  async function confirmPickup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pickupRequest.current !== null) return;
    const request = Symbol();
    pickupRequest.current = request;
    setPickupBusy(true);
    setPickupError('');
    setPickupMessage('');
    try {
      let orderId: string;
      let credential: { type: 'QR'; token: string } | { type: 'MANUAL'; code: string };
      let scanned: { orderId?: unknown; token?: unknown } | undefined;
      try { scanned = JSON.parse(credentialInput); } catch { /* Código manual */ }
      if (scanned && typeof scanned.orderId === 'string' && typeof scanned.token === 'string') {
        orderId = scanned.orderId;
        credential = { type: 'QR', token: scanned.token };
      } else {
        const code = credentialInput.trim();
        const found = await sessionRequest<{ orderId: string }>(`/api/v1/stores/${encodeURIComponent(storeId)}/pickup/by-code`, { method: 'POST', body: JSON.stringify({ code }) });
        if (pickupRequest.current !== request) return;
        orderId = found.orderId;
        credential = { type: 'MANUAL', code };
      }
      const result = await sessionRequest<{ alreadyPickedUp?: unknown } | null>(`/api/v1/stores/${encodeURIComponent(storeId)}/pickup/orders/${encodeURIComponent(orderId)}/confirm`, { method: 'POST', body: JSON.stringify({ credential }) });
      if (pickupRequest.current !== request) return;
      if (typeof result?.alreadyPickedUp !== 'boolean') {
        setPickupError('No se pudo verificar el resultado del retiro. Comprobá el estado del pedido antes de entregar.');
        return;
      }
      setCredentialInput('');
      if (result.alreadyPickedUp) setPickupError('Pedido ya retirado. No entregar nuevamente.');
      else setPickupMessage('Retiro confirmado.');
      refresh();
    } catch (cause) {
      if (pickupRequest.current === request) {
        setPickupError(cause instanceof Error ? cause.message : 'No se pudo confirmar el retiro.');
      }
    } finally {
      if (pickupRequest.current === request) {
        pickupRequest.current = null;
        setPickupBusy(false);
      }
    }
  }

  return <main className="page form-stack"><h1>Cocina y retiros</h1><p>Gestioná la preparación y confirmá la entrega de los pedidos.</p><button className="secondary" onClick={refresh}>Actualizar cola</button><ResourceState {...resource} retry={refresh} />
    <form className="panel form-stack" onSubmit={confirmPickup}><h2>Confirmar retiro</h2><p>Escaneá el QR del cliente en este campo o ingresá su código manual de 12 caracteres.</p><label>QR o código de retiro<input autoComplete="off" required disabled={pickupBusy} value={credentialInput} onChange={event => { if (pickupRequest.current === null) setCredentialInput(event.target.value); }} /></label>{pickupError && <p role="alert" className="error">{pickupError}</p>}{pickupMessage && <p role="status" className="success">{pickupMessage}</p>}<button disabled={pickupBusy}>{pickupBusy ? 'Validando…' : 'Confirmar entrega'}</button></form>
    {resource.data?.length === 0 && <p>No hay pedidos pendientes de preparación.</p>}
    <div className="cards">{resource.data?.map(order => <article className="panel form-stack" key={order.id}>
      <h2>Pedido {order.orderNumber}</h2>
      <p>{order.status === 'CONFIRMED' ? 'Confirmado' : order.preparedAt ? 'Preparado' : 'En preparación'}</p>
      {order.status === 'PREPARING' && order.preparedAt && <p>El retiro todavía no está habilitado.</p>}
      {order.promisedFrom && <p>Inicio de la ventana prometida: {formatPickupTime(order.promisedFrom)}</p>}
      <ul>{order.items.map((item, index) => <li key={`${item.productNameSnapshot}-${index}`}>{item.quantity} × {item.productNameSnapshot}{item.additions.length > 0 && ` — ${item.additions.map(addition => `${addition.quantity} × ${addition.additionNameSnapshot}`).join(', ')}`}</li>)}</ul>
      {kitchenErrors[order.id] && <p role="alert" className="error">{kitchenErrors[order.id]}</p>}
      {order.status === 'CONFIRMED' && <button disabled={pending.has(order.id)} onClick={() => void transition(order, 'start')}>{pending.has(order.id) ? 'Iniciando…' : 'Iniciar preparación'}</button>}
      {order.status === 'PREPARING' && !order.preparedAt && <button disabled={pending.has(order.id)} onClick={() => void transition(order, 'finish')}>{pending.has(order.id) ? 'Finalizando…' : 'Finalizar preparación'}</button>}
    </article>)}</div>
  </main>;
}
