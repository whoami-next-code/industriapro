"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function ResetPasswordTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || "");
  const [loading, setLoading] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    if (!token) {
      setError('Token inválido');
      setLoading(false);
      return;
    }
    if (pw !== pw2) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }
    if (pw.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      setLoading(false);
      return;
    }
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: pw })
      });
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      document.cookie = 'auth_token=; path=/; max-age=0';
      setMessage('Contraseña restablecida. Ahora puedes iniciar sesión.');
      setTimeout(() => router.push('/auth/login'), 1200);
    } catch (err: any) {
      setError(err?.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold mb-4">Restablecer contraseña</h1>
      <form onSubmit={submit} className="space-y-3">
        <input type="password" placeholder="Nueva contraseña" required className="w-full border rounded px-3 py-2" value={pw} onChange={e=>setPw(e.target.value)} />
        <input type="password" placeholder="Confirmar contraseña" required className="w-full border rounded px-3 py-2" value={pw2} onChange={e=>setPw2(e.target.value)} />
        <button disabled={loading} className="inline-flex items-center justify-center rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50">
          {loading ? 'Guardando...' : 'Guardar contraseña'}
        </button>
        {message && <div className="text-sm text-emerald-700">{message}</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
    </section>
  );
}

