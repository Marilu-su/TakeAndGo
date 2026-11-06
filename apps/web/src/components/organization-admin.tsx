'use client';
import { useState, type FormEvent } from 'react';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import type { Store } from '@/lib/types';
import { ResourceState } from './resource-state';
export function OrganizationAdmin({ organizationId }: { organizationId: string }) {
  const path = `/api/v1/organizations/${encodeURIComponent(organizationId)}/stores`;
  const resource = useResource<Store[]>(path);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<Store>();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setBusy(true); setError(''); setMessage('');
    try { await sessionRequest(path, { method: 'POST', body: JSON.stringify({ name: String(values.get('name')).trim(), code: String(values.get('code')).trim().toUpperCase() }) }); form.reset(); resource.reload(); setMessage('Buffet creado. Queda pendiente su configuración inicial.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el buffet.'); }
    finally { setBusy(false); }
  }
  async function deactivate() {
    if (!pending) return;
    setBusy(true); setError(''); setMessage('');
    try { await sessionRequest(`/api/v1/stores/${encodeURIComponent(pending.id)}/deactivate`, { method: 'POST' }); setPending(undefined); resource.reload(); setMessage('Buffet desactivado.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo desactivar el buffet.'); }
    finally { setBusy(false); }
  }
  return <><h2>Buffets de la organización</h2><ResourceState {...resource} retry={resource.reload} />
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {pending && <section role="alertdialog" aria-label="Confirmar desactivación" className="panel form-stack"><p>¿Desactivar {pending.name}?</p><div className="actions"><button disabled={busy} onClick={deactivate}>Confirmar desactivación</button><button className="secondary" disabled={busy} onClick={() => setPending(undefined)}>Volver</button></div></section>}
    <div className="cards">{resource.data?.map(store => <article key={store.id} className="panel form-stack"><h3>{store.name}</h3><p>Código: {store.code}</p><p>{store.status}</p><button className="secondary" disabled={busy || store.status === 'INACTIVE'} onClick={() => setPending(store)}>Desactivar</button></article>)}</div>
    {resource.data?.length === 0 && <p>No hay buffets registrados en esta organización.</p>}
    <form className="panel form-stack" onSubmit={create}><h2>Crear buffet</h2><label>Nombre<input name="name" required maxLength={120} /></label><label>Código<input name="code" required pattern="[A-Za-z]{3}[0-9]{3}" maxLength={6} placeholder="ABC123" title="Tres letras y tres números" /></label><button disabled={busy}>Crear buffet</button></form></>;
}
