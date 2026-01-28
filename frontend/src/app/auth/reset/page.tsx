"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get("token");

  useEffect(() => {
    if (token) {
      router.replace(`/auth/reset/${encodeURIComponent(token)}`);
    }
  }, [router, token]);

  return (
    <section className="mx-auto max-w-sm px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold mb-3">Restablecer contraseña</h1>
      {!token ? (
        <>
          <p className="text-sm text-red-600 mb-4">
            El enlace no es válido o falta el token.
          </p>
          <Link
            href="/auth/forgot-password"
            className="text-sm underline text-blue-700"
          >
            Solicitar un nuevo enlace
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-600">Redirigiendo...</p>
      )}
    </section>
  );
}

export default function ResetPasswordRedirectPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ResetPasswordRedirectInner />
    </Suspense>
  );
}
