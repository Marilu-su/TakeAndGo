'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { type Catalog } from '@/lib/types';
import { ResourceState } from './resource-state';
import { addCartLine, cartTotal, type CartLine } from '@/lib/cart';
import { CartPanel } from './cart-panel';
import { ProductPicker } from './product-picker';
import { meniaPath } from '@/lib/menia';

export function StoreCatalog({ storeId }: { storeId: string }) {
  const resource = useResource<Catalog>(`/api/v1/stores/${encodeURIComponent(storeId)}/catalog`);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [error, setError] = useState('');
  function changeCart(next: CartLine[]) {
    try { cartTotal(next); setLines(next); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el carrito.'); }
  }
  function add(line: CartLine) {
    try { changeCart(addCartLine(lines, line)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo agregar el producto.'); }
  }
  const categories = resource.data?.categories.map(category => ({ ...category, products: category.products.filter(product => `${product.name} ${product.description || ''}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))) })).filter(category => category.products.length);
  return <main className="page"><Link href="/buffets">← Mis buffets</Link><div><p className="muted">Elegí tu próxima comida</p><h1>Catálogo del buffet</h1></div>
    <label>Buscar productos<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre o descripción" /></label>
    <Link className="button" href={meniaPath(storeId)}>Abrir MenIA</Link>
    <ResourceState {...resource} retry={resource.reload} />
    {resource.data && !categories?.length && <div className="panel"><h2>No hay productos para mostrar</h2><p>{query ? 'Probá con otra búsqueda.' : 'Este buffet todavía no tiene productos disponibles.'}</p></div>}
    {categories?.map(category => <section key={category.id} className="form-stack"><h2>{category.name}</h2><div className="cards">{category.products.map(product => <ProductPicker key={product.id} product={product} add={add} />)}</div></section>)}
    {error && <p role="alert" className="error">{error}</p>}<CartPanel lines={lines} change={changeCart} storeId={storeId} />
  </main>;
}
