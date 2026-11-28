'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { createMeniaConversation, MAX_MENIA_MESSAGE_LENGTH, meniaPath, validMeniaMessage, type MeniaContext } from '@/lib/menia';
import { ResourceState } from './resource-state';
import styles from './menia-chat.module.css';

export function MeniaChat({ storeId }: { storeId: string }) {
  const resource = useResource<MeniaContext>(`/api/v1/stores/${encodeURIComponent(storeId)}/menia/context`);
  const context = resource.data?.storeId === storeId ? resource.data : undefined;
  return <main className={`page ${styles.page}`}>
    <nav className="actions" aria-label="Navegación del buffet">
      <Link href={`/buffets/${encodeURIComponent(storeId)}/catalogo`}>← Volver al catálogo</Link>
      <Link href="/buffets">Cambiar buffet</Link>
    </nav>
    <header className="form-stack"><div><p className="muted">Tu asistente en este buffet</p><h1>MenIA</h1></div>
      {context && <div><h2>{context.storeName}</h2><p className="muted">Organización: {context.organizationId}</p></div>}
      <p>Consultá por opciones disponibles del buffet. Esta conversación es temporal y no crea ni modifica pedidos.</p>
    </header>
    <ResourceState {...resource} retry={resource.reload} />
    {context && <MeniaConversation key={storeId} context={context} />}
  </main>;
}

export function MeniaCatalogAssistant({ storeId, onSelectProduct }: { storeId: string; onSelectProduct?: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const resource = useResource<MeniaContext>(open ? `/api/v1/stores/${encodeURIComponent(storeId)}/menia/context` : null);
  const context = resource.data?.storeId === storeId ? resource.data : undefined;
  return <section className="panel form-stack" aria-label="Asistente MenIA en catálogo">
    <div className={`actions ${styles.composer}`}>
      <div>
        <h2>¿No sabés qué pedir? Consultá a MenIA</h2>
        <p className="muted">Pedí recomendaciones del catálogo disponible sin salir de tu compra.</p>
      </div>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => setOpen(prev => !prev)}>
          {open ? 'Ocultar consulta' : 'Consultar a MenIA'}
        </button>
        <Link className="button" href={meniaPath(storeId)}>Abrir MenIA</Link>
      </div>
    </div>
    {open && <>
      {resource.loading && <p role="status" className="muted">Cargando asistente…</p>}
      {resource.error && <div role="alert" className="error form-stack">
        <p>MenIA no está disponible en este momento. Podés seguir comprando desde el catálogo.</p>
        <button type="button" className="secondary" onClick={resource.reload}>Reintentar asistente</button>
      </div>}
      {context && <MeniaConversation key={storeId} context={context} onSelectProduct={onSelectProduct} />}
    </>}
  </section>;
}

export function MeniaConversation({ context, onSelectProduct }: { context: MeniaContext; onSelectProduct?: (title: string) => void }) {
  const [conversation] = useState(() => createMeniaConversation(context.storeId));
  const state = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'nearest' }); }, [state.messages, state.pending]);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (inFlight.current || state.pending || state.forbidden || !validMeniaMessage(draft)) return;
    inFlight.current = true;
    const text = draft;
    setDraft('');
    try { await conversation.send(text); } finally { inFlight.current = false; }
  }
  return <section className={`panel ${styles.chat}`} aria-label={`Conversación con MenIA en ${context.storeName}`}>
    <div role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions" className={styles.messages}>
      {state.messages.length === 0 && <div className={styles.empty}><h2>¿Querés hacer una consulta?</h2><p>Escribí tu primer mensaje para comenzar. Esta conversación es temporal y corresponde solo a este buffet.</p></div>}
      {state.messages.map((message, index) => <article key={index} className={`${styles.bubble} ${message.role === 'user' ? styles.user : styles.assistant}`}>
        <p className={styles.speaker}>{message.role === 'user' ? 'Vos' : 'MenIA'}</p>
        <p>{message.text}</p>
        {message.cards && message.cards.length > 0 && <ul className={styles.recommendations} aria-label="Productos recomendados">
          {message.cards.map(card => <li key={card.id}>
            {onSelectProduct
              ? <button type="button" className={styles.recommendationCard} onClick={() => onSelectProduct(card.title)}>{card.title}</button>
              : <span className={styles.recommendationCard}>{card.title}</span>}
          </li>)}
        </ul>}
      </article>)}
      <div ref={bottom} />
    </div>
    <p role="status" className="muted">{state.pending ? 'MenIA está respondiendo…' : state.messages.at(-1)?.role === 'assistant' ? 'Respuesta recibida' : ''}</p>
    {state.error && <div role="alert" className="error form-stack"><p>{state.error}</p>
      {state.retryable && <button className="secondary" disabled={state.pending} onClick={() => void conversation.retry()}>Reintentar mensaje</button>}
      {state.forbidden && <Link href="/buffets">Volver a Mis buffets</Link>}
    </div>}
    <form onSubmit={submit} className="form-stack" aria-busy={state.pending}>
      <label htmlFor="menia-message">Tu mensaje<textarea id="menia-message" rows={3} maxLength={MAX_MENIA_MESSAGE_LENGTH}
        value={draft} onChange={event => setDraft(event.target.value)} disabled={state.pending || state.forbidden}
        placeholder="Escribí tu consulta…" onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
        }} /></label>
      <div className={`actions ${styles.composer}`}><small className="muted">Enter para enviar · Shift+Enter para otra línea · {draft.length}/{MAX_MENIA_MESSAGE_LENGTH}</small>
        <button type="submit" disabled={state.pending || state.forbidden || !validMeniaMessage(draft)}>{state.pending ? 'Enviando…' : 'Enviar'}</button>
      </div>
    </form>
  </section>;
}
