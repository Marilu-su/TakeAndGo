'use client';
import { useState } from 'react';
import { cartTotal, lineKey, type CartLine } from '@/lib/cart';
import { money } from '@/lib/types';
import type { Order } from '@/lib/types';
import { sessionRequest } from '@/lib/session';
import { ApiError } from '@/lib/api';
import { useRouter } from 'next/navigation';
export function CartPanel({ lines, change, storeId }: { lines: CartLine[]; change: (lines: CartLine[]) => void; storeId: string }) {
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function place() {
    setBusy(true); setError('');
    try {
      const order = await sessionRequest<Order>('/api/v1/orders', { method: 'POST', body: JSON.stringify({ storeId, items: lines.map(line => ({ productId: line.productId, quantity: line.quantity, additionIds: line.additions.map(a => a.id) })) }) });
      change([]); router.push(`/pedidos/${encodeURIComponent(order.id)}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo crear el pedido.';
      setError(cause instanceof ApiError && cause.status ? message : `${message} Revisá Mis pedidos antes de volver a confirmar: la solicitud podría haberse procesado.`);
    } finally { setBusy(false); }
  }
  return <section className="panel form-stack" aria-label="Carrito de compras"><h2>{review ? 'Resumen del pedido' : 'Tu carrito'}</h2>
    {!lines.length && <p>Agregá productos del catálogo para comenzar.</p>}
    {lines.map(line => <article key={lineKey(line)} className="panel form-stack"><h3>{line.name}</h3>{line.additions.length > 0 && <p>{line.additions.map(a => a.name).join(', ')}</p>}<p>{money((line.priceCents + line.additions.reduce((sum, a) => sum + a.priceCents, 0)) * line.quantity)}</p><label>Cantidad de {line.name}<input disabled={busy} type="number" min={1} max={2147483647} step={1} value={line.quantity} onChange={e => { const quantity = Number(e.target.value); if (Number.isSafeInteger(quantity) && quantity > 0) { setReview(false); change(lines.map(current => lineKey(current) === lineKey(line) ? { ...current, quantity } : current)); } }} /></label><button disabled={busy} className="secondary" onClick={() => { setReview(false); change(lines.filter(current => lineKey(current) !== lineKey(line))); }}>Quitar {line.name}</button></article>)}
    {error && <p role="alert" className="error">{error}</p>}
    {lines.length > 0 && <><p className="price">Total estimado: {money(cartTotal(lines))}</p><p className="muted">La API validará disponibilidad y calculará el precio definitivo al crear el pedido.</p><button disabled={busy} className="secondary" onClick={() => setReview(!review)}>{review ? 'Volver al carrito' : 'Revisar pedido'}</button>{review && <div className="form-stack"><p>Al confirmar se crea una reserva de stock. Los pagos se incorporan en otra etapa.</p><button disabled={busy} onClick={place}>{busy ? 'Creando reserva…' : 'Confirmar pedido'}</button></div>}</>}
  </section>;
}
