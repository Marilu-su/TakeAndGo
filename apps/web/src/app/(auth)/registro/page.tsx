
import Link from "next/link";

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">
        Crear cuenta
      </h1>

      <p className="text-gray-500">
        Registrate para comenzar a utilizar Take&Go.
      </p>

      <Link href="/login" className="font-semibold underline">
        Iniciar sesión
      </Link>
    </main>
  );
}
