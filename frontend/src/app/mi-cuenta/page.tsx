"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetchAuth, requireAuthOrRedirect } from "@/lib/api";

type Quote = { id: number; status: string; createdAt: string; notes?: string };
type Order = { id: number; status: string; total?: number; createdAt: string };
type Profile = { email: string; fullName?: string; phone?: string };

export default function MiCuentaPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!requireAuthOrRedirect()) return;
    async function load() {
      setLoading(true);
      try {
        const [prof, peds, cots] = await Promise.all([
          apiFetchAuth<Profile>("/auth/profile"),
          apiFetchAuth<Order[]>("/pedidos").catch(() => []),
          apiFetchAuth<Quote[]>("/cotizaciones").catch(() => []),
        ]);
        setProfile(prof);
        setOrders(Array.isArray(peds) ? peds : []);
        const email = prof?.email?.toLowerCase();
        const mine = (Array.isArray(cots) ? cots : []).filter(
          (q: any) => q.customerEmail?.toLowerCase() === email
        );
        setQuotes(mine);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await apiFetchAuth<Profile>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone"),
        }),
      });
      setProfile(updated);
      setMsg("Datos guardados");
    } catch (err: any) {
      setMsg(err?.message || "No se pudieron guardar los datos");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p>Cargando tu panel...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p>Inicia sesión para ver tu información.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/mis-pedidos" className="underline text-blue-700">
            Ver compras
          </Link>
          <Link href="/mis-cotizaciones" className="underline text-blue-700">
            Ver cotizaciones
          </Link>
        </div>
      </div>

      <form onSubmit={saveProfile} className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
        <h2 className="font-semibold">Datos personales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="fullName"
            placeholder="Nombre completo"
            defaultValue={profile.fullName}
            className="border rounded px-3 py-2"
          />
          <input
            name="phone"
            placeholder="Teléfono"
            defaultValue={profile.phone}
            className="border rounded px-3 py-2"
          />
          <input
            disabled
            value={profile.email}
            className="border rounded px-3 py-2 bg-gray-50 text-gray-500"
          />
        </div>
        <button
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {msg && <p className="text-sm text-zinc-700">{msg}</p>}
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Historial de compras</h3>
            <Link href="/mis-pedidos" className="text-xs underline text-blue-700">
              Ver todo
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-zinc-600">Sin compras registradas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id} className="flex justify-between border-b pb-1">
                  <span>Pedido #{o.id}</span>
                  <span className="text-zinc-600">{o.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Cotizaciones</h3>
            <Link href="/mis-cotizaciones" className="text-xs underline text-blue-700">
              Ver todo
            </Link>
          </div>
          {quotes.length === 0 ? (
            <p className="text-sm text-zinc-600">Sin cotizaciones registradas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {quotes.slice(0, 5).map((q) => (
                <li key={q.id} className="flex justify-between border-b pb-1">
                  <span>Cotización #{q.id}</span>
                  <span className="text-zinc-600">{q.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

