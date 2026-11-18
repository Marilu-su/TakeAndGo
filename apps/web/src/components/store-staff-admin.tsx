'use client';

import { useState, type FormEvent } from 'react';
import { sessionRequest } from '@/lib/session';

export function StoreStaffAdmin({ storeId }: { storeId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get('email')).trim();
    setBusy(true); setError(''); setMessage('');
    try {
      await sessionRequest(`/api/v1/stores/${encodeURIComponent(storeId)}/staff`, {
        method: 'POST', body: JSON.stringify({ email, role: 'STORE_EMPLOYEE' }),
      });
      form.reset();
      setMessage('Personal habilitado. Debe cerrar sesión y volver a ingresar para ver cocina y retiros.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo habilitar al personal.'); }
    finally { setBusy(false); }
  }

  return <form className="panel form-stack" onSubmit={assign}>
    <h2>Personal de cocina y retiros</h2>
    <p>La persona necesita una cuenta de Take&amp;Go. Al habilitarla, su rol de staff anterior se reemplaza.</p>
    <label>Correo electrónico<input name="email" type="email" required autoComplete="email" /></label>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="success">{message}</p>}
    <button disabled={busy}>{busy ? 'Habilitando…' : 'Habilitar personal'}</button>
  </form>;
}
