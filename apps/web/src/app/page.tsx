"use client";

import { useCallback, useEffect, useState } from "react";
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Take&amp;Go</h1>
        <p className="mt-2 text-lg opacity-70">
          Plataforma SaaS de Take Away Inteligente
        </p>
      </div>

      <section className="w-full max-w-sm rounded-xl border border-gray-300 p-6">
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
          className="mt-6 w-full rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          Volver a consultar
        </button>
      </section>
    </main>
  );
}