import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Ingresar a Take&Go</h1>

      <p className="text-gray-500">
        Accedé a tu cuenta para utilizar los servicios de tu buffet.
      </p>

      <Link href="/registro" className="font-semibold underline">
        Crear cuenta
      </Link>
    </main>
  );
}