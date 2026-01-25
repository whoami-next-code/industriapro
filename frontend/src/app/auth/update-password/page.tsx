'use client';

import Link from 'next/link';

export default function UpdatePasswordPage() {
  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">Actualiza tu contraseña</h1>
        <p className="text-sm text-gray-600">
          Este enlace ya no se usa. Para restablecer tu contraseña solicita un nuevo enlace.
        </p>
        <Link
          href="/auth/forgot-password"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 text-white px-4 py-2 text-sm"
        >
          Ir a recuperación de contraseña
        </Link>
      </div>
    </section>
  );
}
