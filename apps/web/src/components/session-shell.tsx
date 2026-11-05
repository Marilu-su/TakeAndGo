'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { getActor, type Actor } from '@/lib/session';
import { ApiError } from '@/lib/api';
export function SessionShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const router = useRouter();
  const [actor, setActor] = useState<Actor>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    getActor().then(value => {
      if (!active) return;
      const allowed = admin ? ['STORE_ADMIN', 'ORGANIZATION_ADMIN'].includes(value.role) : value.role === 'CUSTOMER';
      if (!allowed) setError('Tu cuenta no tiene permisos para acceder a esta sección.'); else setActor(value);
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) router.replace('/login');
      else if (cause instanceof ApiError && cause.status === 403) router.replace('/alta-cliente');
      else setError(cause instanceof Error ? cause.message : 'No se pudo verificar la sesión.');
    });
    return () => { active = false; };
  }, [admin, router, revision]);
  async function logout() {
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      setActor(undefined); router.replace('/login'); router.refresh();
    } catch { setError('No se pudo cerrar la sesión. Reintentá.'); }
  }
  return <><header className="site-header"><Link className="brand" href={admin ? '/admin' : '/buffets'}>Take&amp;Go</Link><nav>
    <Link href={admin ? '/admin' : '/buffets'}>{admin ? 'Administración' : 'Mis buffets'}</Link>
    {!admin && <Link href="/pedidos">Mis pedidos</Link>}<button className="secondary" onClick={logout}>Cerrar sesión</button>
  </nav></header>{error ? <main className="page"><p role="alert" className="error">{error}</p><button onClick={() => { setError(''); setRevision(v => v + 1); }}>Reintentar</button></main> : actor ? children : <main className="page" role="status">Verificando sesión…</main>}</>;
}
