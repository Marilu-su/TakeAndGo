'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import { money, orderStatus, type Order } from '@/lib/types';
import { ResourceState } from './resource-state';
const date = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
export function OrdersList() {
  const resource = useResource<Order[]>('/api/v1/orders');
  return <main className="page"><h1>Mis pedidos</h1><div className="actions"><Link href="/buffets">Explorar buffets</Link><button className="secondary" disabled={resource.loading} onClick={resource.reload}>Actualizar pedidos</button></div><ResourceState {...resource} retry={resource.reload} />
    {resource.data?.length === 0 && <section className="panel"><h2>Todavía no hiciste pedidos</h2><p>Elegí un buffet y agregá productos a tu carrito.</p></section>}
    <div className="cards">{resource.data?.map(order => <article key={order.id} className="panel form-stack"><h2>Pedido #{order.orderNumber}</h2><p>{date(order.createdAt)}</p><p>{orderStatus[order.status] || order.status}</p><p className="price">{money(order.totalCents)}</p><Link className="button" href={`/pedidos/${encodeURIComponent(order.id)}`}>Ver detalle</Link></article>)}</div>
  </main>;
}
export function OrderDetail({ id }: { id: string }) {
  const resource = useResource<Order>(`/api/v1/orders/${encodeURIComponent(id)}`);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const reload = resource.reload;
  useEffect(() => {
    const interval = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 30000);
    return () => clearInterval(interval);
  }, [reload]);
  async function cancel() {
    setBusy(true); setError('');
    try { await sessionRequest(`/api/v1/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); setConfirm(false); setMessage('Reserva cancelada.'); resource.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cancelar.'); }
    finally { setBusy(false); }
  }
  const order = resource.data;
  return <main className="page"><Link href="/pedidos">← Mis pedidos</Link><h1>Detalle del pedido</h1><button className="secondary" disabled={busy || resource.loading} onClick={resource.reload}>Actualizar estado</button><ResourceState {...resource} retry={resource.reload} />
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {order && <section className="panel form-stack"><h2>Pedido #{order.orderNumber}</h2><p role="status">Estado: {orderStatus[order.status] || order.status}</p><p>Creado: {date(order.createdAt)}</p>
      {order.status === 'RESERVED' && order.reservedUntil && <p>Vencimiento de la reserva: {date(order.reservedUntil)}. La API confirma su estado al actualizar.</p>}
      {order.items.map((item, index) => <article className="panel" key={index}><h3>{item.quantity} × {item.productNameSnapshot}</h3>{item.additions.map((a, i) => <p key={i}>+ {a.additionNameSnapshot}</p>)}<p>{money(item.subtotalCents)}</p></article>)}
      <p className="price">Total: {money(order.totalCents)}</p>
      {order.status === 'RESERVED' && <button className="secondary" disabled={busy} onClick={() => setConfirm(true)}>Cancelar reserva</button>}
      {confirm && order.status === 'RESERVED' && <div role="alertdialog" aria-label="Confirmar cancelación" className="form-stack"><p>¿Cancelar esta reserva y liberar su stock?</p><div className="actions"><button disabled={busy} onClick={cancel}>Confirmar cancelación</button><button className="secondary" disabled={busy} onClick={() => setConfirm(false)}>Conservar pedido</button></div></div>}
    </section>}
  </main>;
}
