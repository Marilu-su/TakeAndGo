'use client';
import { useRef, useState } from 'react';
import { cartTotal, lineKey, type CartLine } from '@/lib/cart';
import { money } from '@/lib/types';
import type { Order, PickupWindowAvailability } from '@/lib/types';
import { sessionRequest } from '@/lib/session';
import { ApiError } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useResource } from '@/lib/use-resource';
import { formatPickupTime, orderRequestBody, pickupWindowsPath, resolvePickupSelection } from '@/lib/pickup-windows';
import { ResourceState } from './resource-state';
export function CartPanel({ lines, change, storeId }: { lines: CartLine[]; change: (lines: CartLine[]) => void; storeId: string }) {
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const submitting = useRef(false);
  const router = useRouter();
  const resource = useResource<PickupWindowAvailability>(review ? pickupWindowsPath(storeId) : null);
  const availability = resource.loading || resource.error ? undefined : resource.data;
  const { window: selectedWindow, expired } = resolvePickupSelection(availability, selected);
  if (review && expired) {
    setSelected('');
    setError('El horario elegido ya no está disponible. Elegí otra ventana para confirmar el pedido.');
  }
  const canConfirm = !resource.loading && !resource.error && !!availability &&
    (availability.requiresPickupWindow === false || !!selectedWindow);

  async function place() {
    if (submitting.current || !review || !canConfirm || !lines.length) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const order = await sessionRequest<Order>('/api/v1/orders', {
        method: 'POST',
        body: orderRequestBody(storeId, lines, selectedWindow?.promisedFrom),
      });
      change([]); router.push(`/pedidos/${encodeURIComponent(order.id)}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.code === 'PICKUP_WINDOW_UNAVAILABLE') {
        setError('El horario elegido ya no está disponible. Elegí otra ventana para confirmar el pedido.');
        setSelected('');
        resource.reload();
      } else {
        const message = cause instanceof Error ? cause.message : 'No se pudo crear el pedido.';
        setError(cause instanceof ApiError && cause.status ? message : `${message} Revisá Mis pedidos antes de volver a confirmar: la solicitud podría haberse procesado.`);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return <section className="panel form-stack" aria-label="Carrito de compras"><h2>{review ? 'Resumen del pedido' : 'Tu carrito'}</h2>
    {!lines.length && <p>Agregá productos del catálogo para comenzar.</p>}
    {lines.map(line => <article key={lineKey(line)} className="panel form-stack"><h3>{line.name}</h3>{line.additions.length > 0 && <p>{line.additions.map(a => a.name).join(', ')}</p>}<p>{money((line.priceCents + line.additions.reduce((sum, a) => sum + a.priceCents, 0)) * line.quantity)}</p><label>Cantidad de {line.name}<input disabled={busy} type="number" min={1} max={2147483647} step={1} value={line.quantity} onChange={e => { const quantity = Number(e.target.value); if (Number.isSafeInteger(quantity) && quantity > 0) { setReview(false); change(lines.map(current => lineKey(current) === lineKey(line) ? { ...current, quantity } : current)); } }} /></label><button disabled={busy} className="secondary" onClick={() => { setReview(false); change(lines.filter(current => lineKey(current) !== lineKey(line))); }}>Quitar {line.name}</button></article>)}
    {error && <p role="alert" className="error">{error}</p>}
    {lines.length > 0 && <>
      <p className="price">Total estimado: {money(cartTotal(lines))}</p>
      <p className="muted">La API validará disponibilidad y calculará el precio definitivo al crear el pedido.</p>
      <button disabled={busy} className="secondary" onClick={() => {
        if (!review) resource.reload();
        setReview(!review);
      }}>{review ? 'Volver al carrito' : 'Revisar pedido'}</button>
      {review && <div className="form-stack">
        <ResourceState {...resource} retry={resource.reload} />
        {availability?.requiresPickupWindow && (
          availability.windows.length ? <>
            <label>Ventana de retiro de hoy (hora de Buenos Aires)
              <select value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setError(''); }}>
                <option value="">Elegí un horario</option>
                {availability.windows.map(window => <option key={window.promisedFrom} value={window.promisedFrom}>
                  {formatPickupTime(window.promisedFrom)}–{formatPickupTime(window.promisedTo)}
                </option>)}
              </select>
            </label>
            {selectedWindow && <p>Tolerancia hasta las {formatPickupTime(selectedWindow.toleranceUntil)}.</p>}
          </> : <>
            <p role="status">No hay ventanas de retiro disponibles para hoy.</p>
            <button className="secondary" onClick={resource.reload}>Actualizar horarios</button>
          </>
        )}
        <p>Al confirmar, se reserva tu pedido durante 5 minutos para que puedas realizar el pago.</p>
        <button disabled={busy || !canConfirm} onClick={place}>{busy ? 'Creando reserva…' : 'Confirmar pedido'}</button>
      </div>}
    </>}
  </section>;
}
