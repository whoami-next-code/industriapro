import Link from 'next/link';

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Registro deshabilitado
        </h1>
        <p className="text-slate-600 mb-6">
          El acceso es exclusivo para personal autorizado. Solicita tu cuenta al administrador.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 transition-colors"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </section>
  );
}
