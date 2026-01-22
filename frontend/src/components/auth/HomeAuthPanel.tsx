"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AuthLoginForm } from "@/components/auth/AuthLoginForm";

type Profile = { userId: number; email: string; role: string };

export function HomeAuthPanel() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    async function check() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token') ?? sessionStorage.getItem('token');
        if (!token) {
          setProfile(null);
        } else {
          const data = await apiFetch('/api/auth/profile');
          setProfile(data as Profile);
        }
      } catch (e: any) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [isClient]);

  function logout() {
    try {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    } finally {
      // recarga para refrescar estado en toda la app
      window.location.reload();
    }
  }

  if (!isClient) {
    // Evita desajustes de hidratación devolviendo un placeholder estable hasta que monte en cliente
    return <div aria-hidden="true" className="mt-8" />;
  }

  if (loading) {
    return (
      <section className="mt-8" aria-label="Acceso">
        <div className="h-24 rounded-xl border bg-white animate-pulse" />
      </section>
    );
  }

  if (profile) {
    return (
      <section className="mt-8" aria-label="Usuario">
        <div className="border rounded-xl bg-white p-4">
          <h2 className="text-xl font-semibold mb-2">Bienvenido</h2>
          <p className="text-sm text-zinc-700">{profile.email}</p>
          <p className="text-xs text-zinc-500">Rol: {profile.role}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/mis-pedidos" className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm">Mis pedidos</a>
            <a href="/perfil" className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm">Mi perfil</a>
            <button onClick={logout} className="inline-flex items-center justify-center rounded-md bg-black text-white px-3 py-2 text-sm">Cerrar sesión</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8" aria-label="Acceso">
      <div className="border rounded-xl bg-white p-4">
        <div role="tabpanel">
          <AuthLoginForm />
        </div>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
      </div>
    </section>
  );
}

