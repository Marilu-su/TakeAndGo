'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useActor } from '@/components/session-shell';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import { ResourceState } from '@/components/resource-state';

type KitchenOrder = {
  id: string;
  orderNumber: number;
  status: 'CONFIRMED' | 'PREPARING';
  promisedFrom?: string | null;
  items: { productNameSnapshot: string; quantity: number; additions: { additionNameSnapshot: string; quantity: number }[] }[];
};

export function KitchenQueue() {
  const actor = useActor();
  const path = `/api/v1/stores/${encodeURIComponent(actor.storeId ?? '')}/kitchen/orders`;
  const resource = useResource<KitchenOrder[]>(path);
  const [credentialInput, setCredentialInput] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [pickupMessage, setPickupMessage] = useState('');
  const [pickupBusy, setPickupBusy] = useState(false);
  const refresh = useCallback(() => resource.reload(), [resource.reload]);

  async function transition(order: KitchenOrder, action: 'start' | 'finish') {
    try {
      await sessionRequest(`/api/v1/stores/${encodeURIComponent(actor.storeId ?? '')}/kitchen/orders/${encodeURIComponent(order.id)}/${action}`, { method: 'POST' });
      refresh();
    } catch (cause) { setPickupError(cause instanceof Error ? cause.message : 'No se pudo actualizar el pedido.'); }
  }
  async function confirmPickup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPickupBusy(true); setPickupError(''); setPickupMessage('');
    try {
      let orderId: string;
      let credential: { type: 'QR'; token: string } | { type: 'MANUAL'; code: string };
      let scanned: { orderId?: unknown; token?: unknown } | undefined;
      try { scanned = JSON.parse(credentialInput); } catch { /* Código manual */ }
      if (scanned && typeof scanned.orderId === 'string' && typeof scanned.token === 'string') {
        orderId = scanned.orderId;
        credential = { type: 'QR', token: scanned.token };
      } else {
        const found = await sessionRequest<{ orderId: string; orderNumber: number }>(`/api/v1/stores/${encodeURIComponent(actor.storeId ?? '')}/pickup/by-code`, { method: 'POST', body: JSON.stringify({ code: credentialInput.trim() }) });
        orderId = found.orderId;
        credential = { type: 'MANUAL', code: credentialInput.trim() };
      }
      await sessionRequest(`/api/v1/stores/${encodeURIComponent(actor.storeId ?? '')}/pickup/orders/${encodeURIComponent(orderId)}/confirm`, { method: 'POST', body: JSON.stringify({ credential }) });
      setCredentialInput(''); setPickupMessage('Retiro confirmado.'); refresh();
    } catch (cause) { setPickupError(cause instanceof Error ? cause.message : 'No se pudo confirmar el retiro.'); }
    finally { setPickupBusy(false); }
  }

  return <main className="page form-stack"><h1>Cocina y retiros</h1><p>Gestioná la preparación y confirmá la entrega de los pedidos.</p><button className="secondary" onClick={refresh}>Actualizar cola</button><ResourceState {...resource} retry={refresh} />
    <form className="panel form-stack" onSubmit={confirmPickup}><h2>Confirmar retiro</h2><p>Escaneá el QR del cliente en este campo o ingresá su código manual de 12 caracteres.</p><label>QR o código de retiro<input autoComplete="off" required value={credentialInput} onChange={event => setCredentialInput(event.target.value)} /></label>{pickupError && <p role="alert" className="error">{pickupError}</p>}{pickupMessage && <p role="status" className="success">{pickupMessage}</p>}<button disabled={pickupBusy}>{pickupBusy ? 'Validando…' : 'Confirmar entrega'}</button></form>
    {resource.data?.length === 0 && <p>No hay pedidos pendientes de preparación.</p>}
    <div className="cards">{resource.data?.map(order => <article className="panel form-stack" key={order.id}>
      <h2>Pedido {order.orderNumber}</h2><p>{order.status === 'CONFIRMED' ? 'Confirmado' : 'En preparación'}</p>
      {order.promisedFrom && <p>Retiro desde: {new Date(order.promisedFrom).toLocaleTimeString()}</p>}
      <ul>{order.items.map((item, index) => <li key={`${item.productNameSnapshot}-${index}`}>{item.quantity} × {item.productNameSnapshot}{item.additions.length > 0 && ` — ${item.additions.map(addition => `${addition.quantity} × ${addition.additionNameSnapshot}`).join(', ')}`}</li>)}</ul>
      {order.status === 'CONFIRMED' ? <button onClick={() => void transition(order, 'start')}>Iniciar preparación</button> : <button onClick={() => void transition(order, 'finish')}>Finalizar preparación</button>}
    </article>)}</div>
  </main>;
}
