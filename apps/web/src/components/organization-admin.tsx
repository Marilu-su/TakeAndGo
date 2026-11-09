'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import type { Store } from '@/lib/types';
import { ResourceState } from './resource-state';
export function OrganizationAdmin({ organizationId }: { organizationId: string }) {
  const path = `/api/v1/organizations/${encodeURIComponent(organizationId)}/stores`;
  const resource = useResource<Store[]>(path);
  const settings = useResource<{ id: string; maxAdvanceDays: number }>(`/api/v1/organizations/${encodeURIComponent(organizationId)}/settings`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<Store>();
  const [staffMessage, setStaffMessage] = useState('');
  const [advanceDays, setAdvanceDays] = useState(7);
  useEffect(() => { if (settings.data) setAdvanceDays(settings.data.maxAdvanceDays); }, [settings.data]);
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
  async function assignStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setBusy(true); setError(''); setStaffMessage('');
    try {
      await sessionRequest(`/api/v1/organizations/${encodeURIComponent(organizationId)}/staff`, {
        method: 'POST',
        body: JSON.stringify({ email: String(values.get('email')).trim(), role: String(values.get('role')), storeId: String(values.get('storeId')) }),
      });
      form.reset(); setStaffMessage('Rol asignado. La persona debe cerrar sesión y volver a ingresar para ver sus accesos.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo asignar el rol.'); }
    finally { setBusy(false); }
  }
  async function saveAdvanceDays(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await sessionRequest(`/api/v1/organizations/${encodeURIComponent(organizationId)}/settings`, { method: 'PATCH', body: JSON.stringify({ maxAdvanceDays: advanceDays }) });
      setMessage('Anticipación máxima actualizada.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.'); }
    finally { setBusy(false); }
  }
  return <><h2>Buffets de la organización</h2><ResourceState {...resource} retry={resource.reload} />
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {pending && <section role="alertdialog" aria-label="Confirmar desactivación" className="panel form-stack"><p>¿Desactivar {pending.name}?</p><div className="actions"><button disabled={busy} onClick={deactivate}>Confirmar desactivación</button><button className="secondary" disabled={busy} onClick={() => setPending(undefined)}>Volver</button></div></section>}
    <div className="cards">{resource.data?.map(store => <article key={store.id} className="panel form-stack"><h3>{store.name}</h3><p>Código: {store.code}</p><p>{store.status}</p><button className="secondary" disabled={busy || store.status === 'INACTIVE'} onClick={() => setPending(store)}>Desactivar</button></article>)}</div>
    {resource.data?.length === 0 && <p>No hay buffets registrados en esta organización.</p>}
    <form className="panel form-stack" onSubmit={saveAdvanceDays}><h2>Anticipación de pedidos</h2><p>Máximo de días por adelantado en todos los buffets de esta organización.</p><ResourceState {...settings} retry={settings.reload} /><label>Días<input type="number" min={1} max={30} step={1} required value={advanceDays} onChange={event => setAdvanceDays(Number(event.target.value))} /></label><button disabled={busy || settings.loading}>Guardar configuración</button></form>
    <form className="panel form-stack" onSubmit={create}><h2>Crear buffet</h2><label>Nombre<input name="name" required maxLength={120} /></label><label>Código<input name="code" required pattern="[A-Za-z]{3}[0-9]{3}" maxLength={6} placeholder="ABC123" title="Tres letras y tres números" /></label><button disabled={busy}>Crear buffet</button></form>
    <form className="panel form-stack" onSubmit={assignStaff}>
      <h2>Habilitar personal de un buffet</h2>
      <p>La persona debe tener una cuenta creada. Asignar un rol nuevo reemplaza el rol de staff anterior.</p>
      <label>Correo electrónico<input name="email" type="email" required /></label>
      <label>Buffet<select name="storeId" required defaultValue=""><option value="" disabled>Elegí un buffet</option>{resource.data?.filter(store => store.status !== 'INACTIVE').map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
      <label>Rol<select name="role" defaultValue="STORE_ADMIN"><option value="STORE_ADMIN">Administrador del buffet</option><option value="STORE_EMPLOYEE">Personal de cocina y retiro</option></select></label>
      {staffMessage && <p role="status" className="success">{staffMessage}</p>}
      <button disabled={busy || !resource.data?.length}>Asignar rol</button>
    </form></>;
}
