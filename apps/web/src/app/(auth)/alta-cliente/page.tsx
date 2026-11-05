'use client';
import { useState, type FormEvent } from 'react';
import { sessionRequest } from '@/lib/session';
import { useRouter } from 'next/navigation';
export default function AltaCliente() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = String(new FormData(event.currentTarget).get('name')).trim();
    setBusy(true); setError('');
    try { await sessionRequest('/api/v1/me/customer', { method: 'POST', body: JSON.stringify({ name }) }); router.replace('/buffets'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar el alta.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><form onSubmit={submit} className="panel form-stack"><h1>Completá tu perfil de cliente</h1><p>Tu cuenta necesita un perfil de Take&amp;Go para asociar buffets.</p><label>Nombre<input name="name" required maxLength={120} /></label>{error && <p role="alert" className="error">{error}</p>}<button disabled={busy}>Continuar</button><a href="/login">Volver a ingresar</a></form></main>;
}
