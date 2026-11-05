'use client';
import { useState } from 'react';
import { cartTotal, lineKey, type CartLine } from '@/lib/cart';
import { money } from '@/lib/types';
export function CartPanel({ lines, change }: { lines: CartLine[]; change: (lines: CartLine[]) => void }) {
  const [review, setReview] = useState(false);
  return <section className="panel form-stack" aria-label="Carrito de compras"><h2>{review ? 'Resumen del pedido' : 'Tu carrito'}</h2>
    {!lines.length && <p>Agregá productos del catálogo para comenzar.</p>}
    {lines.map(line => <article key={lineKey(line)} className="panel form-stack"><h3>{line.name}</h3>{line.additions.length > 0 && <p>{line.additions.map(a => a.name).join(', ')}</p>}<p>{money((line.priceCents + line.additions.reduce((sum, a) => sum + a.priceCents, 0)) * line.quantity)}</p><label>Cantidad de {line.name}<input type="number" min={1} max={2147483647} step={1} value={line.quantity} onChange={e => { const quantity = Number(e.target.value); if (Number.isSafeInteger(quantity) && quantity > 0) change(lines.map(current => lineKey(current) === lineKey(line) ? { ...current, quantity } : current)); }} /></label><button className="secondary" onClick={() => change(lines.filter(current => lineKey(current) !== lineKey(line)))}>Quitar {line.name}</button></article>)}
    {lines.length > 0 && <><p className="price">Total estimado: {money(cartTotal(lines))}</p><p className="muted">La API validará disponibilidad y calculará el precio definitivo al crear el pedido.</p><button className="secondary" onClick={() => setReview(!review)}>{review ? 'Volver al carrito' : 'Revisar pedido'}</button></>}
  </section>;
}
