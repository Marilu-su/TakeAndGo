'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { money, type Catalog } from '@/lib/types';
import { ResourceState } from './resource-state';

export function StoreCatalog({ storeId }: { storeId: string }) {
  const resource = useResource<Catalog>(`/api/v1/stores/${encodeURIComponent(storeId)}/catalog`);
  const [query, setQuery] = useState('');
  const categories = resource.data?.categories.map(category => ({ ...category, products: category.products.filter(product => `${product.name} ${product.description || ''}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))) })).filter(category => category.products.length);
  return <main className="page"><Link href="/buffets">← Mis buffets</Link><div><p className="muted">Elegí tu próxima comida</p><h1>Catálogo del buffet</h1></div>
    <label>Buscar productos<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre o descripción" /></label>
    <ResourceState {...resource} retry={resource.reload} />
    {resource.data && !categories?.length && <div className="panel"><h2>No hay productos para mostrar</h2><p>{query ? 'Probá con otra búsqueda.' : 'Este buffet todavía no tiene productos disponibles.'}</p></div>}
    {categories?.map(category => <section key={category.id} className="form-stack"><h2>{category.name}</h2><div className="cards">{category.products.map(product => <article key={product.id} className="panel form-stack"><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}<p className="price">{money(product.priceCents)}</p>{product.additions.length > 0 && <div><h4>Adicionales disponibles</h4>{product.additions.map(addition => <p key={addition.id}>{addition.name} · +{money(addition.priceCents)}</p>)}</div>}</article>)}</div></section>)}
  </main>;
}
