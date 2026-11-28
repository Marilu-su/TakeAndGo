"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getHealth, type HealthResponse } from "@/lib/health";

type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; data: HealthResponse }
  | { kind: "error"; message: string };

export default function Home() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });

  const loadHealth = useCallback(() => {
    getHealth()
      .then((data) => {
        if (data.status === "ok") {
          setHealth({ kind: "ok", data });
        } else {
          setHealth({
            kind: "error",
            message: `Estado inesperado: ${data.status}`,
          });
        }
      })
      .catch((error: unknown) => {
        setHealth({
          kind: "error",
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      });
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  function handleRetry() {
    setHealth({ kind: "loading" });
    loadHealth();
  }

  return (
    <main className="tg-entry">
      <div className="tg-entry-grid">
        <header className="tg-hero">
          <BrandMark />
          <h1>Take<span>&amp;</span>Go</h1>
          <p>Pedí por adelantado.<br /> Retirá en tu buffet.</p>
        </header>

        <section className="tg-access">
          <h2>¿Qué querés hacer?</h2>
          <p>Elegí cómo usar Take&amp;Go. Los accesos de administración requieren una cuenta habilitada.</p>
          <nav aria-label="Accesos de Take&Go" className="tg-links">
            <Link className="button" href="/registro">Quiero comprar</Link>
            <Link className="button secondary" href="/login">Ya tengo una cuenta</Link>
            <div className="tg-org">
              <Link href="/registro?destino=organizacion">Crear una organización</Link>
              <Link href="/login?destino=organizacion">Ya tengo una cuenta y quiero crear una organización</Link>
            </div>
          </nav>
          <section className="tg-staff">
            <h3 className="font-semibold">¿Trabajás en un buffet?</h3>
            <p className="mt-2 text-sm opacity-70">Ingresá con la cuenta que te habilitó tu organización. Los permisos los asigna un administrador.</p>
            <Link className="tg-text-link" href="/login">Acceso para personal y administradores</Link>
          </section>
        </section>
      </div>

      <section className="tg-health">
        <h2 className="mb-4 text-lg font-semibold">Estado del sistema</h2>

        {health.kind === "loading" && <p>🟡 Consultando backend...</p>}

        {health.kind === "ok" && (
          <div className="space-y-1">
            <p>🟢 Backend operativo</p>
            {health.data.database && (
              <p>
                {health.data.database === "ok" ? "🟢" : "🔴"} Base de datos:{" "}
                {health.data.database}
              </p>
            )}
          </div>
        )}

        {health.kind === "error" && (
          <div className="space-y-1">
            <p>🔴 Backend no disponible</p>
            <p className="text-sm opacity-70">{health.message}</p>
          </div>
        )}

        <button
          onClick={handleRetry}
          disabled={health.kind === "loading"}
          className="secondary"
        >
          Volver a consultar
        </button>
      </section>
    </main>
  );
}
