'use client';
import { useState, type FormEvent } from 'react';
import { useResource } from '@/lib/use-resource';
import { ResourceState } from './resource-state';
import { sessionRequest } from '@/lib/session';
type StockItem = { id: string; name: string; stock: { availableStock: number; reservedStock: number } | null };
type Stock = { products: StockItem[]; additions: StockItem[] };
export function StockView({ storeId }: { storeId: string }) {
  const resource = useResource<Stock>(`/api/v1/stores/${encodeURIComponent(storeId)}/stock`);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function adjust(event: FormEvent<HTMLFormElement>, kind: 'products' | 'additions', id: string) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    setError(''); setMessage('');
    try {
      await sessionRequest(`/api/v1/stores/${encodeURIComponent(storeId)}/stock`, { method: 'PUT', body: JSON.stringify({ ...(kind === 'products' ? { productId: id } : { additionId: id }), availableStock: Number(values.get('availableStock')), reason: String(values.get('reason')).trim() }) });
      setMessage('Stock actualizado y ajuste registrado.'); resource.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el stock.'); }
  }
  return <section className="form-stack"><div className="actions"><h2>Stock del buffet</h2><button className="secondary" disabled={resource.loading} onClick={resource.reload}>Actualizar stock</button></div><ResourceState {...resource} retry={resource.reload} />{error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {resource.data && (['products', 'additions'] as const).map(kind => <section className="form-stack" key={kind}><h3>{kind === 'products' ? 'Productos' : 'Adicionales'}</h3>{resource.data![kind].length === 0 && <p>No hay elementos cargados.</p>}<div className="cards">{resource.data![kind].map(item => <article className="panel form-stack" key={item.id}><h3>{item.name}</h3>{item.stock ? <><p>Disponible: {item.stock.availableStock}</p><p>Reservado: {item.stock.reservedStock}</p></> : <p>Sin control de stock configurado.</p>}<form className="form-stack" onSubmit={event => void adjust(event, kind, item.id)}><label>Stock disponible<input type="number" name="availableStock" min={item.stock?.reservedStock ?? 0} step={1} defaultValue={item.stock?.availableStock ?? 0} required /></label><label>Motivo del ajuste<input name="reason" maxLength={240} required /></label><button>Guardar ajuste</button></form></article>)}</div></section>)}
  </section>;
}
