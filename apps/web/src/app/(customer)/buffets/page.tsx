
"use client";

import { useState } from "react";

type Buffet = {
  id: string;
  nombre: string;
  organizacion: string;
};

// Datos exclusivos para probar la interfaz.
// Luego serán reemplazados por la API real.
const buffetsDemo: Buffet[] = [
  {
    id: "demo-1",
    nombre: "Buffet de ejemplo A",
    organizacion: "Organización de prueba",
  },
  {
    id: "demo-2",
    nombre: "Buffet de ejemplo B",
    organizacion: "Organización de prueba",
  },
];

export default function BuffetsPage() {
  const [modoDemo, setModoDemo] = useState(false);
  const [buffetSeleccionado, setBuffetSeleccionado] =
    useState<string | null>(null);

  const esDesarrollo = process.env.NODE_ENV === "development";
  const buffets = esDesarrollo && modoDemo ? buffetsDemo : [];

  const buffetActivo = buffets.find(
    (buffet) => buffet.id === buffetSeleccionado
  );

  function cambiarModoDemo() {
    setModoDemo(!modoDemo);
    setBuffetSeleccionado(null);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mis buffets</h1>

        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Seleccioná el buffet donde querés realizar tu compra.
        </p>
      </div>

      {esDesarrollo && (
        <div className="mb-6 rounded-xl border border-amber-500/40 p-4">
          <p className="font-semibold">Modo desarrollo</p>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Todavía no estamos consultando los buffets reales.
            Podés probar la interfaz con datos de ejemplo.
          </p>

          <button
            type="button"
            onClick={cambiarModoDemo}
            className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            {modoDemo
              ? "Ocultar datos de ejemplo"
              : "Mostrar datos de ejemplo"}
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Buffets asociados
        </h2>

        {buffets.length === 0 ? (
          <div className="rounded-xl border border-gray-300 p-8 text-center dark:border-gray-700">
            <h3 className="text-lg font-semibold">
              No hay buffets para mostrar
            </h3>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              La lista real estará disponible cuando
              integremos la cuenta del cliente con la API.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {buffets.map((buffet) => {
              const seleccionado =
                buffetSeleccionado === buffet.id;

              return (
                <article
                  key={buffet.id}
                  className={`rounded-xl border p-6 ${
                    seleccionado
                      ? "border-emerald-500"
                      : "border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {buffet.organizacion}
                  </p>

                  <h3 className="text-xl font-bold">
                    {buffet.nombre}
                  </h3>

                  <button
                    type="button"
                    aria-pressed={seleccionado}
                    onClick={() =>
                      setBuffetSeleccionado(buffet.id)
                    }
                    className={`mt-5 w-full rounded-lg px-4 py-2 font-semibold ${
                      seleccionado
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                    }`}
                  >
                    {seleccionado
                      ? "Buffet seleccionado"
                      : "Seleccionar buffet"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {buffetActivo && (
        <section className="mt-6 rounded-xl border border-emerald-500 p-5">
          <h2 className="font-semibold">Buffet activo</h2>

          <p className="mt-1">{buffetActivo.nombre}</p>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            La navegación al catálogo se incorporará
            en la próxima funcionalidad.
          </p>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-dashed border-gray-400 p-6 dark:border-gray-700">
        <h2 className="text-xl font-semibold">
          Asociar otro buffet
        </h2>

        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Próximamente vas a poder asociarte a un buffet
          ingresando su código de seis caracteres (AAA999).
        </p>
      </section>
    </main>
  );
}
