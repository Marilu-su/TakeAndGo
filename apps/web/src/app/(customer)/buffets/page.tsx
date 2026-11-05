'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import type { Store } from '@/lib/types';
import { ResourceState } from '@/components/resource-state';
export default function BuffetsPage() {
  const resource = useResource<Store[]>('/api/v1/me/stores');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function associate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const storeCode = String(new FormData(form).get('code')).trim().toUpperCase();
    setBusy(true); setError(''); setMessage('');
    try {
      await sessionRequest('/api/v1/me/stores', { method: 'POST', body: JSON.stringify({ storeCode }) });
      form.reset(); resource.reload(); setMessage('Buffet asociado correctamente.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo asociar el buffet.'); }
    finally { setBusy(false); }
  }
  return <main className="page"><div><p className="muted">Tu próxima pausa empieza acá</p><h1>Mis buffets</h1><p>Elegí dónde querés pedir y explorá su catálogo.</p></div>
    <ResourceState {...resource} retry={resource.reload} />
    {resource.data && <section className="cards">{resource.data.length === 0 ? <div className="panel"><h2>Todavía no tenés buffets</h2><p>Ingresá el código de tu buffet para comenzar.</p></div> : resource.data.map(store => <article className="panel form-stack" key={store.id}>
      <p className="muted">Código {store.code}</p><h2>{store.name}</h2><p>{store.status === 'ACTIVE' ? 'Buffet activo' : 'Buffet inactivo'}</p>
      {store.status === 'ACTIVE' && <><button className={selected === store.id ? '' : 'secondary'} aria-pressed={selected === store.id} onClick={() => setSelected(store.id)}>{selected === store.id ? 'Buffet seleccionado' : 'Seleccionar buffet'}</button>{selected === store.id && <Link className="button" href={`/buffets/${encodeURIComponent(store.id)}/catalogo`}>Ver catálogo</Link>}</>}
    </article>)}</section>}
    <form className="panel form-stack" onSubmit={associate}><h2>Asociar un buffet</h2><label>Código del buffet<input name="code" required pattern="[A-Za-z]{3}[0-9]{3}" maxLength={6} placeholder="ABC123" title="Tres letras seguidas de tres números" autoComplete="off" /></label>
      {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}<button disabled={busy}>{busy ? 'Asociando…' : 'Asociar buffet'}</button>
    </form></main>;
}
