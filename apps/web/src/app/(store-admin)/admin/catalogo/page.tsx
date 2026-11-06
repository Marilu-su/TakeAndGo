'use client';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import type { Actor } from '@/lib/session';
import { ResourceState } from '@/components/resource-state';
import { CatalogAdmin } from '@/components/catalog-admin';
export default function Page() {
  const resource = useResource<Actor>('/api/v1/me');
  return <main className="page"><Link href="/admin">← Panel</Link><h1>Administrar catálogo</h1><ResourceState {...resource} retry={resource.reload} />
    {resource.data?.role === 'STORE_ADMIN' && resource.data.storeId ? <CatalogAdmin storeId={resource.data.storeId} /> : resource.data && <p role="alert">Esta sección requiere el rol de administrador de buffet.</p>}
  </main>;
}
