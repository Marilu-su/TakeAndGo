'use client';
import { useResource } from '@/lib/use-resource';
import { ResourceState } from './resource-state';
type StockItem = { id: string; name: string; stock: { availableStock: number; reservedStock: number } | null };
type Stock = { products: StockItem[]; additions: StockItem[] };
export function StockView({ storeId }: { storeId: string }) {
  const resource = useResource<Stock>(`/api/v1/stores/${encodeURIComponent(storeId)}/stock`);
  return <section className="form-stack"><div className="actions"><h2>Stock del buffet</h2><button className="secondary" disabled={resource.loading} onClick={resource.reload}>Actualizar stock</button></div><ResourceState {...resource} retry={resource.reload} />
    {resource.data && (['products', 'additions'] as const).map(kind => <section className="form-stack" key={kind}><h3>{kind === 'products' ? 'Productos' : 'Adicionales'}</h3>{resource.data![kind].length === 0 && <p>No hay elementos cargados.</p>}<div className="cards">{resource.data![kind].map(item => <article className="panel form-stack" key={item.id}><h3>{item.name}</h3>{item.stock ? <><p>Disponible: {item.stock.availableStock}</p><p>Reservado: {item.stock.reservedStock}</p></> : <p>Sin control de stock configurado.</p>}</article>)}</div></section>)}
  </section>;
}
