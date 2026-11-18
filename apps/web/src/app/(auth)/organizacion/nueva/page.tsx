'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { sessionRequest } from '@/lib/session';

export default function NewOrganizationPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const name = String(new FormData(event.currentTarget).get('name')).trim();
      await sessionRequest('/api/v1/organizations', { method: 'POST', body: JSON.stringify({ name }) });
      router.replace('/admin');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la organización.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><form className="panel form-stack" onSubmit={create}>
    <h1>Crear una organización</h1>
    <p>Al crearla, vas a quedar como su administrador y podrás crear buffets y habilitar a sus responsables.</p>
    <label>Nombre de la organización<input name="name" required maxLength={120} /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button disabled={busy}>{busy ? 'Creando…' : 'Crear organización y continuar'}</button>
  </form></main>;
}
