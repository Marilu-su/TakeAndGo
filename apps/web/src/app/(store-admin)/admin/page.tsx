'use client';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import type { Actor } from '@/lib/session';
import { ResourceState } from '@/components/resource-state';
import { OrganizationAdmin } from '@/components/organization-admin';
export default function AdminPage() {
  const resource = useResource<Actor>('/api/v1/me');
  const actor = resource.data;
  return <main className="page"><h1>Administración</h1><ResourceState {...resource} retry={resource.reload} />
    {actor?.role === 'ORGANIZATION_ADMIN' && actor.organizationId && <OrganizationAdmin organizationId={actor.organizationId} />}
    {actor?.role === 'STORE_ADMIN' && actor.storeId && <section className="panel form-stack"><h2>Gestioná tu buffet</h2><p>Administrá categorías, productos y adicionales de tu buffet.</p><div className="actions"><Link className="button" href="/admin/catalogo">Administrar catálogo</Link><Link className="button" href="/admin/stock">Consultar stock</Link></div></section>}
  </main>;
}
