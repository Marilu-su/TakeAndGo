
import Link from "next/link";
import type { ReactNode } from "react";

export default function StoreAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
        <Link href="/admin" className="text-xl font-bold">
          Take&Go Admin
        </Link>

        <nav className="flex gap-6">
          <Link href="/admin">Panel</Link>
          <Link href="/login">Ingresar</Link>
        </nav>
      </header>

      {children}
    </div>
  );
}
