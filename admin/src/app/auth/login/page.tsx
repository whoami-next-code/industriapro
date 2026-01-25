"use client";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const data = await apiFetch<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email') || ''),
          password: String(form.get('password') || ''),
        })
      });
      localStorage.setItem('token', data.access_token);
      document.cookie = `auth_token=${data.access_token}; path=/; max-age=604800`;
      window.dispatchEvent(new Event('auth-token-changed'));
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message.trim() ? err.message : 'Credenciales inválidas';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="min-h-[calc(100vh-56px)] grid place-items-center px-4 sm:px-6 lg:px-8 py-10 bg-center bg-cover"
      style={{ backgroundImage: "url(/brand/oculux/images/login-img.png)" }}
      aria-label="Sección de inicio de sesión"
    >
      <div className="w-full max-w-sm sp-card sp-card-static">
        <div className="sp-card-body">
          <h1 className="text-2xl font-bold mb-4">Login Admin</h1>
        <form onSubmit={submit} className="space-y-4" aria-label="Formulario de inicio de sesión">
          <div>
            <label className="sp-form-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="email@dominio.com"
              required
              className="sp-input"
            />
          </div>
          <div>
            <label className="sp-form-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="sp-input"
            />
          </div>
          <button
            disabled={loading}
            className="sp-button sp-button-primary w-full justify-center"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          {error && <div className="text-sm text-red-600" role="alert">{error}</div>}
        </form>
        </div>
      </div>
    </section>
  );
}

