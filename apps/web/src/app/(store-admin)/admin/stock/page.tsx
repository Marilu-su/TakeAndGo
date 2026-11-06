'use client';
import Link from 'next/link';
import { useActor } from '@/components/session-shell';
import { StockView } from '@/components/stock-view';
export default function Page() {
  const actor = useActor();
  return <main className="page"><Link href="/admin">← Panel</Link><h1>Disponibilidad y reservas</h1>{actor.role === 'STORE_ADMIN' && actor.storeId ? <StockView storeId={actor.storeId} /> : <p role="alert">Se requiere el rol de administrador de buffet.</p>}</main>;
}
