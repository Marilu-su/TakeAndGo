'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { getActor, sessionRequest } from '@/lib/session';
import { ApiError } from '@/lib/api';
export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    const name = String(form.get('name') || '').trim();
    setBusy(true); setError('');
    try {
      const result = register ? await authClient.signUp.email({ email, password, name }) : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || 'No se pudo ingresar.');
      if (register) {
        const session = await authClient.getSession();
        if (!session.data) throw new Error('Cuenta creada. Verificá tu correo si Neon lo solicita y luego iniciá sesión.');
        await sessionRequest('/api/v1/me/customer', { method: 'POST', body: JSON.stringify({ name }) });
      }
      try {
        const actor = await getActor();
        router.replace(actor.role === 'CUSTOMER' ? '/buffets' : '/admin');
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) router.replace('/alta-cliente');
        else throw cause;
      }
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><form className="panel form-stack" onSubmit={submit}>
    <Link href="/" className="brand">Take&amp;Go</Link><h1>{register ? 'Crear cuenta' : 'Bienvenido de nuevo'}</h1>
    {register && <label>Nombre<input name="name" required maxLength={120} autoComplete="name" /></label>}
    <label>Correo electrónico<input name="email" type="email" required autoComplete="email" /></label>
    <label>Contraseña<input name="password" type="password" required minLength={8} autoComplete={register ? 'new-password' : 'current-password'} /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button disabled={busy}>{busy ? 'Procesando…' : register ? 'Registrarme' : 'Ingresar'}</button>
    <Link href={register ? '/login' : '/registro'}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta'}</Link>
  </form></main>;
}
