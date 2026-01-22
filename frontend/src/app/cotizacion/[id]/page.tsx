"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetchAuth, requireAuthOrRedirect } from "@/lib/api";
import { usePublicSocket } from "@/lib/PublicSocketProvider";

type ProgressUpdate = {
  message: string;
  status?: string;
  estimatedDate?: string;
  createdAt: string;
  author?: string;
  progressPercent?: number;
};

type Quote = {
  id: number;
  code?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status: string;
  createdAt: string;
  estimatedDeliveryDate?: string;
  estimatedDate?: string;
  progressPercent?: number;
  totalAmount?: number;
  budget?: string | number;
  notes?: string;
  items: { productId?: number; name?: string; quantity: number; materials?: string; measures?: string; observations?: string }[];
  progressUpdates?: ProgressUpdate[];
};

const STATUS_FLOW = ["PENDIENTE", "APROBADA", "PRODUCCION", "INSTALACION", "FINALIZADA", "CANCELADA"] as const;

export default function QuoteStatusPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id ?? 0);
  const [item, setItem] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastEvent } = usePublicSocket();

  useEffect(() => {
    if (lastEvent?.name === "cotizaciones.updated" && lastEvent.data?.id === id) {
       apiFetchAuth<Quote>(`/cotizaciones/${id}/reporte`)
         .then((data) => setItem(data))
         .catch((e: any) => console.error("Error reloading quote", e));
    }
  }, [lastEvent, id]);

  useEffect(() => {
    const token = requireAuthOrRedirect(`/cotizacion/${id}`);
    if (!token) return;
    setLoading(true);
    setError(null);
    apiFetchAuth<Quote>(`/cotizaciones/${id}/reporte`)
      .then((data) => setItem(data))
      .catch((e: any) => setError(e?.message ?? "Error cargando la cotización"))
      .finally(() => setLoading(false));
  }, [id]);

  const statusList = useMemo(() => STATUS_FLOW, []);
  const currentIndex = useMemo(() => {
    if (!item) return -1;
    const idx = statusList.indexOf(item.status.toUpperCase() as any);
    return idx >= 0 ? idx : statusList.indexOf("PENDIENTE");
  }, [item, statusList]);

  const fmtDate = (d?: string) => {
    if (!d) return "No definido";
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? "No definido" : parsed.toLocaleString("es-PE");
  };

  const progress = item?.progressPercent ?? (currentIndex >= 0 ? (currentIndex / (statusList.length - 1)) * 100 : 0);
  const amount = item?.totalAmount ?? (typeof item?.budget === "string" ? Number(item.budget) : item?.budget);

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-4">
        <Link href="/mis-cotizaciones" className="text-sm underline">
          Volver
        </Link>
        <button
          onClick={() => router.push("/mis-pedidos")}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
        >
          Ir a mis pedidos
        </button>
      </div>
      <h1 className="text-2xl font-bold mb-2">Estado de cotización #{id}</h1>
      {error && <div className="p-2 bg-red-100 text-red-700 rounded mb-3">{error}</div>}
      {loading ? (
        <div>Cargando...</div>
      ) : item ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {statusList.map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs ${
                    i <= currentIndex ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {i + 1}
                </div>
                {i < statusList.length - 1 && (
                  <div className={`w-16 h-0.5 ${i < currentIndex ? "bg-emerald-600" : "bg-zinc-200"}`}></div>
                )}
              </div>
            ))}
          </div>
          <ul className="text-sm text-zinc-700 flex gap-6">
            {statusList.map((s, i) => (
              <li key={s} className={i === currentIndex ? "font-semibold text-emerald-700" : ""}>
                {s.replace("_", " ")}
              </li>
            ))}
          </ul>

          <div className="border rounded p-4 space-y-2">
            <div className="text-sm">Cliente: <strong>{item.customerName}</strong> ({item.customerEmail})</div>
            {item.customerPhone && <div className="text-sm">Teléfono: {item.customerPhone}</div>}
            <div className="text-sm">Creada: {fmtDate(item.createdAt)}</div>
            <div className="text-sm">Entrega estimada: {fmtDate(item.estimatedDeliveryDate ?? item.estimatedDate)}</div>
            <div className="text-sm">Progreso: {Math.round(progress)}%</div>
            {amount !== undefined && !Number.isNaN(amount) && (
              <div className="text-sm">Monto estimado: S/ {Number(amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div>
            )}
            {item.notes && <div className="text-sm mt-2">Notas: {item.notes}</div>}
          </div>

          <div className="border rounded p-4">
            <div className="text-sm font-medium mb-2">Items solicitados</div>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {(item.items ?? []).map((it, idx) => (
                <li key={idx}>
                  {it.name || `Producto #${it.productId ?? "?"}`} — Cantidad: {it.quantity}
                  {it.materials && <span className="text-zinc-500"> · Materiales: {it.materials}</span>}
                  {it.measures && <span className="text-zinc-500"> · Medidas: {it.measures}</span>}
                  {it.observations && <span className="text-zinc-500"> · Obs: {it.observations}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="border rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Avances y reportes</h3>
              <span className="text-xs text-zinc-500">{item.progressUpdates?.length ?? 0} eventos</span>
            </div>
            {item.progressUpdates?.length ? (
              <div className="space-y-3">
                {item.progressUpdates.map((p, idx) => (
                  <div key={`${p.createdAt}-${idx}`} className="rounded border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-zinc-800">{p.status ?? "Actualización"}</div>
                      <div className="text-xs text-zinc-500">{fmtDate(p.createdAt)}</div>
                    </div>
                    <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{p.message}</p>
                    <div className="text-xs text-zinc-500 mt-1">
                      {p.estimatedDate && <span className="mr-2">Entrega estimada: {fmtDate(p.estimatedDate)}</span>}
                      {p.author && <span>Autor: {p.author}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Sin avances registrados.</p>
            )}
          </div>
        </div>
      ) : (
        <div>No se encontró la cotización.</div>
      )}
    </section>
  );
}
