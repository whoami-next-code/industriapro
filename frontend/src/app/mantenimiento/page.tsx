"use client";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function Mantenimiento() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setOk(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      customerName: 'Solicitud mantenimiento',
      customerEmail: '',
      items: [],
      notes: `MANTENIMIENTO | Equipo: ${String(form.get('equipo') || '')} | Detalle: ${String(form.get('desc') || '')}`,
    };
    try {
      await apiFetch("/cotizaciones", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOk('Solicitud enviada. Nuestro equipo técnico lo contactará.');
      (e.currentTarget as HTMLFormElement).reset();
    } catch {
      setOk('No se pudo enviar la solicitud.');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold mb-4">Mantenimiento y servicios</h1>
      <p className="text-zinc-700 mb-6">Seguimiento de servicios y solicitudes de mantenimiento preventivo y correctivo.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded p-4 bg-white">
          <h2 className="font-semibold mb-2">Historial</h2>
          <ul className="text-sm text-zinc-600 space-y-2">
            <li>Visita técnica - 12/09/2025</li>
            <li>Reemplazo de piezas - 22/08/2025</li>
          </ul>
        </div>
        <form onSubmit={submit} className="border rounded p-4 bg-white space-y-3">
          <h2 className="font-semibold">Nueva solicitud</h2>
          <input name="equipo" required placeholder="Equipo" className="w-full border rounded px-3 py-2" />
          <textarea name="desc" required placeholder="Descripción del problema" className="w-full border rounded px-3 py-2" rows={4} />
          <button disabled={loading} className="inline-flex items-center justify-center rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50">{loading ? 'Enviando...' : 'Enviar solicitud'}</button>
          {ok && <div className="text-sm text-zinc-700">{ok}</div>}
        </form>
      </div>
    </section>
  );
}

