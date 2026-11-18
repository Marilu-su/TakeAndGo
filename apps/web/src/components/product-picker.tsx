'use client';
import { useState, type FormEvent } from 'react';
import { money, type Product } from '@/lib/types';
import type { CartLine } from '@/lib/cart';
export function ProductPicker({ product, add }: { product: Product; add: (line: CartLine) => void }) {
  const [message, setMessage] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const selected = new Set(form.getAll('addition').map(String));
    add({ productId: product.id, name: product.name, priceCents: product.priceCents, quantity: Number(form.get('quantity')), additions: product.additions.filter(a => selected.has(a.id)) });
    setMessage('Producto agregado al carrito.');
  }
  return <form className="panel form-stack" onSubmit={submit}><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}{product.dietaryTags?.length ? <p>Apto: {product.dietaryTags.map(tag => ({ VEGETARIAN: 'vegetariano', VEGAN: 'vegano', GLUTEN_FREE: 'sin TACC' }[tag] || tag)).join(', ')}</p> : null}{product.allergensVerified ? <p>Alérgenos declarados: {product.allergens?.length ? product.allergens.join(', ') : 'ninguno'}</p> : <p>Información de alérgenos no revisada</p>}<p className="price">{money(product.priceCents)}</p>
    {product.additions.length > 0 && <fieldset className="form-stack"><legend>Adicionales opcionales</legend>{product.additions.map(a => <label key={a.id}><span><input type="checkbox" name="addition" value={a.id} />{a.name} · +{money(a.priceCents)}</span></label>)}</fieldset>}
    <label>Cantidad de {product.name}<input name="quantity" type="number" min={1} max={2147483647} step={1} required defaultValue={1} /></label><button>Agregar al carrito</button>{message && <p role="status">{message}</p>}
  </form>;
}
