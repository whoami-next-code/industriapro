"use client";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

export function AuthLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email') || ''),
          password: String(form.get('password') || ''),
        })
      });
      const storage = remember ? window.localStorage : window.sessionStorage;
      storage.setItem('token', data.access_token);
      router.push('/');
    } catch (err: any) {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input name="email" type="email" placeholder="Email" required className="w-full border rounded px-3 py-2" />
      <input name="password" type="password" placeholder="Contraseña" required className="w-full border rounded px-3 py-2" />
      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
          Recordar sesión
        </label>
        <a href="/auth/forgot" className="text-emerald-700 hover:underline">¿Olvidaste tu contraseña?</a>
      </div>
      <button disabled={loading} className="inline-flex items-center justify-center rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50">{loading ? 'Ingresando...' : 'Ingresar'}</button>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="text-sm text-zinc-600">Solicita tu acceso al administrador.</div>
    </form>
  );
}

