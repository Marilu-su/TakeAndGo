'use client';
import { useState, type FormEvent } from 'react';
import { sessionRequest } from '@/lib/session';
import { useRouter } from 'next/navigation';
const PENDING_CUSTOMER_NAME = 'takeandgo.pending-customer-name';

function initializeName(input: HTMLInputElement | null) {
  if (input) input.defaultValue = sessionStorage.getItem(PENDING_CUSTOMER_NAME) ?? '';
}

export default function AltaCliente() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const customerName = String(new FormData(event.currentTarget).get('name')).trim();
    setBusy(true); setError('');
    try { await sessionRequest('/api/v1/me/customer', { method: 'POST', body: JSON.stringify({ name: customerName }) }); sessionStorage.removeItem(PENDING_CUSTOMER_NAME); router.replace('/buffets'); }
    catch (cause) {
      if (cause instanceof Error && 'status' in cause && cause.status === 409) {
        sessionStorage.removeItem(PENDING_CUSTOMER_NAME);
        router.replace('/buffets');
        return;
      }
      setError(cause instanceof Error ? cause.message : 'No se pudo completar el alta.');
    }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><form onSubmit={submit} className="panel form-stack"><h1>Completá tu perfil de cliente</h1><p>Tu cuenta necesita un perfil de Take&amp;Go para asociar buffets.</p><label>Nombre<input name="name" required maxLength={120} ref={initializeName} /></label>{error && <p role="alert" className="error">{error}</p>}<button disabled={busy}>Continuar</button><a href="/login">Volver a ingresar</a></form></main>;
}
