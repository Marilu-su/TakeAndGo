'use client';
import { useState, type FormEvent } from 'react';
import { useResource } from '@/lib/use-resource';
import { sessionRequest } from '@/lib/session';
import { money, type Addition, type Category, type Product } from '@/lib/types';
import { parsePriceCents } from '@/lib/price';
import { ResourceState } from './resource-state';

type Kind = 'categories' | 'products' | 'additions';
type Row = Category & Partial<Product>;
type Mutation = { path: string; method: string; body?: object; label: string };
const labels: Record<Kind, string> = { categories: 'Categorías', products: 'Productos', additions: 'Adicionales' };

export function CatalogAdmin({ storeId }: { storeId: string }) {
  const [kind, setKind] = useState<Kind>('categories');
  const [edit, setEdit] = useState<Row>();
  const [configure, setConfigure] = useState<Row>();
  const [pending, setPending] = useState<Mutation>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formVersion, setFormVersion] = useState(0);
  const base = `/api/v1/stores/${encodeURIComponent(storeId)}`;
  const resource = useResource<Row[]>(`${base}/${kind}`);
  const categories = useResource<Category[]>(`${base}/categories`);
  const additions = useResource<Addition[]>(`${base}/additions`);
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const body: Record<string, string | number | null> = { name: String(form.get('name')).trim() };
      if (!body.name) throw new Error('El nombre es obligatorio.');
      if (kind !== 'categories') body.priceCents = parsePriceCents(String(form.get('price')));
      if (kind === 'products') {
        body.categoryId = String(form.get('category'));
        body.description = String(form.get('description')).trim() || null;
        body.basePreparationSeconds = Number(form.get('seconds'));
        if (!body.categoryId || !Number.isSafeInteger(body.basePreparationSeconds) || body.basePreparationSeconds < 0) throw new Error('Revisá la categoría y el tiempo de preparación.');
      }
      setPending({ path: `${base}/${kind}${edit ? '/' + encodeURIComponent(edit.id) : ''}`, method: edit ? 'PATCH' : 'POST', body, label: `${edit ? 'Guardar cambios de' : 'Crear'} ${body.name}` });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisá los datos.'); }
  }
  async function execute() {
    if (!pending) return;
    setBusy(true); setError('');
    try {
      await sessionRequest(pending.path, { method: pending.method, body: pending.body ? JSON.stringify(pending.body) : undefined });
      setPending(undefined); setEdit(undefined); setFormVersion(n => n + 1);
      setMessage('Operación completada.'); resource.reload(); categories.reload(); additions.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <><div className="actions" aria-label="Secciones del catálogo">{(Object.keys(labels) as Kind[]).map(value => <button key={value} className={kind === value ? '' : 'secondary'} disabled={busy || !!pending} aria-pressed={kind === value} onClick={() => { setKind(value); setEdit(undefined); setConfigure(undefined); setError(''); setMessage(''); }}>{labels[value]}</button>)}</div>
    <h2>{labels[kind]}</h2><ResourceState {...resource} retry={resource.reload} />
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {pending && <section className="panel form-stack" role="alertdialog" aria-label="Confirmar operación"><h3>{pending.label}</h3><p>Confirmá para aplicar esta operación al buffet.</p><div className="actions"><button disabled={busy} onClick={execute}>{busy ? 'Guardando…' : 'Confirmar'}</button><button className="secondary" disabled={busy} onClick={() => setPending(undefined)}>Volver</button></div></section>}
    <div className="cards">{resource.data?.map(row => <article className="panel form-stack" key={row.id}><h3>{row.name}</h3>{row.description && <p>{row.description}</p>}{row.priceCents !== undefined && <p className="price">{money(row.priceCents)}</p>}<p>{row.isActive ? 'Activo' : 'Inactivo'}</p><div className="actions"><button className="secondary" disabled={busy || !!pending || !row.isActive} onClick={() => { setEdit(row); setConfigure(undefined); setError(''); }}>Editar</button><button className="secondary" disabled={busy || !!pending || !row.isActive} onClick={() => setPending({ path: `${base}/${kind}/${encodeURIComponent(row.id)}/deactivate`, method: 'POST', label: `Desactivar ${row.name}` })}>Desactivar</button>{kind === 'products' && <button className="secondary" disabled={busy || !!pending || !row.isActive} onClick={() => setConfigure(row)}>Configurar adicionales</button>}</div></article>)}</div>
    {resource.data?.length === 0 && <p>Todavía no hay elementos en esta sección.</p>}
    {configure && <ProductAdditions key={configure.id} base={base} product={configure} additions={additions.data || []} close={() => setConfigure(undefined)} />}
    <form className="panel form-stack" key={`${kind}-${edit?.id || 'new'}-${formVersion}`} onSubmit={prepare}><h2>{edit ? `Editar ${edit.name}` : 'Crear nuevo elemento'}</h2><fieldset className="form-stack" disabled={busy || !!pending}>
      <label>Nombre<input name="name" required maxLength={120} defaultValue={edit?.name} /></label>
      {kind !== 'categories' && <label>Precio en pesos<input name="price" inputMode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" defaultValue={edit?.priceCents !== undefined ? (edit.priceCents / 100).toFixed(2) : ''} placeholder="1500,00" /></label>}
      {kind === 'products' && <><ResourceState {...categories} retry={categories.reload} /><label>Categoría<select name="category" required defaultValue={edit?.categoryId || ''}><option value="" disabled>Seleccionar categoría</option>{categories.data?.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Descripción<textarea name="description" maxLength={2000} defaultValue={edit?.description || ''} /></label><label>Tiempo base de preparación (segundos)<input name="seconds" type="number" min={0} max={2147483647} step={1} required defaultValue={edit?.basePreparationSeconds ?? 0} /></label></>}
      <div className="actions"><button>{edit ? 'Revisar cambios' : 'Revisar creación'}</button>{edit && <button type="button" className="secondary" onClick={() => setEdit(undefined)}>Cancelar edición</button>}</div>
    </fieldset></form></>;
}

function ProductAdditions({ base, product, additions, close }: { base: string; product: Row; additions: Addition[]; close: () => void }) {
  const path = `${base}/products/${encodeURIComponent(product.id)}/additions`;
  const resource = useResource<Addition[]>(path);
  const [pending, setPending] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await sessionRequest(path, { method: 'PUT', body: JSON.stringify({ additionIds: pending }) }); setPending(undefined); setMessage('Adicionales guardados.'); resource.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los adicionales.'); }
    finally { setBusy(false); }
  }
  return <section className="panel form-stack"><h2>Adicionales de {product.name}</h2><ResourceState {...resource} retry={resource.reload} />{error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {resource.data && <form key={resource.data.map(a => a.id).join(',')} className="form-stack" onSubmit={event => { event.preventDefault(); setMessage(''); setPending(new FormData(event.currentTarget).getAll('addition').map(String)); }}><fieldset disabled={busy || !!pending} className="form-stack">{additions.filter(a => a.isActive).map(a => <label key={a.id}><span><input type="checkbox" name="addition" value={a.id} defaultChecked={resource.data?.some(current => current.id === a.id)} />{a.name} · {money(a.priceCents)}</span></label>)}{additions.length === 0 && <p>No hay adicionales cargados.</p>}<button>Revisar selección</button></fieldset></form>}
    {pending && <div role="alertdialog" aria-label="Confirmar adicionales"><p>¿Reemplazar la selección por {pending.length} adicionales?</p><div className="actions"><button disabled={busy} onClick={save}>Confirmar</button><button className="secondary" disabled={busy} onClick={() => setPending(undefined)}>Volver</button></div></div>}
    <button className="secondary" disabled={busy} onClick={close}>Cerrar configuración</button></section>;
}
