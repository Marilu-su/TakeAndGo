'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { createMeniaConversation, MAX_MENIA_MESSAGE_LENGTH, validMeniaMessage, type MeniaContext } from '@/lib/menia';
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
      <p>La interpretación inteligente estará disponible próximamente. Por ahora podés enviar mensajes y continuar comprando desde el catálogo.</p>
    </header>
    <ResourceState {...resource} retry={resource.reload} />
    {context && <MeniaConversation key={storeId} context={context} />}
  </main>;
}

export function MeniaConversation({ context }: { context: MeniaContext }) {
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
        <p className={styles.speaker}>{message.role === 'user' ? 'Vos' : 'MenIA'}</p><p>{message.text}</p>
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
