"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetchAuth, requireAuthOrRedirect, getImageUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicSocket } from "@/lib/PublicSocketProvider";

function computeTotal(o: { total?: any; items?: Array<{ price?: any; quantity?: any }> }) {
  const coerced = Number(o?.total);
  if (Number.isFinite(coerced)) return coerced;
  const sum = (o.items ?? []).reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  return sum;
}

function formatMoney(n: number) {
  try {
    return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return (Math.round(n * 100) / 100).toFixed(2);
  }
}

type OrderItem = {
  productId?: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  thumbnailUrl?: string;
};
type Order = {
  id: number;
  userId?: number;
  items: OrderItem[];
  total: number;
  status: "PENDIENTE" | "PAGADO" | "ENVIADO" | "CANCELADO";
  shippingAddress?: string;
  createdAt: string | Date;
  comprobante?: any;
};

type QuoteItem = { productId: number; quantity: number };
type MaterialUsage = { name: string; quantity: number; unit: string; provider?: string };
type ProgressUpdate = {
  message: string;
  status?: string;
  estimatedDate?: string;
  attachmentUrls?: string[];
  materialList?: MaterialUsage[];
  createdAt?: string;
  author?: string;
  technician?: string;
  progressPercent?: number;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
};
type Quote = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: QuoteItem[];
  status: "PENDIENTE" | "NUEVA" | "EN_PROCESO" | "ENVIADA" | "COMPLETADA" | "CERRADA" | "RECHAZADA" | string;
  notes?: string;
  createdAt: string | Date;
  progressUpdates?: ProgressUpdate[];
  progressPercent?: number;
  estimatedDeliveryDate?: string;
};
type ContactMessage = {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
  respuesta?: string;
  respondidoEn?: string;
  respondidoPor?: string;
  estado: "nuevo" | "en_proceso" | "atendido" | "cancelado";
  creadoEn: string;
};
type Product = { id: number; name: string; price: number; imageUrl?: string; thumbnailUrl?: string };

function statusBadgeClass(status: Quote["status"]) {
  // Normalizar estado: 'NUEVA' del backend = 'PENDIENTE' en el frontend
  const normalized = status === 'NUEVA' ? 'PENDIENTE' : status;
  
  switch (normalized) {
    case 'PENDIENTE':
      return { bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'EN_PROCESO':
      return { bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'ENVIADA':
    case 'COMPLETADA':
      return { bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'CERRADA':
      return { bg: 'bg-zinc-100', border: 'border-zinc-200' };
    case 'RECHAZADA':
      return { bg: 'bg-red-50', border: 'border-red-200' };
    default:
      return { bg: 'bg-zinc-100', border: 'border-zinc-200' };
  }
}

function formatStatus(status: Quote["status"]): string {
  const normalized = status === 'NUEVA' ? 'PENDIENTE' : status === 'COMPLETADA' ? 'COMPLETADA' : status;
  const statusMap: Record<string, string> = {
    'PENDIENTE': 'Pendiente',
    'EN_PROCESO': 'En Proceso',
    'ENVIADA': 'Enviada',
    'COMPLETADA': 'Completada',
    'CERRADA': 'Cerrada',
    'RECHAZADA': 'Rechazada',
    'NUEVA': 'Nueva',
  };
  return statusMap[normalized] || status;
}

function printQuote(q: Quote, products: Product[]) {
  const prodMap = new Map(products.map(p => [p.id, p]));
  const rows = (q.items ?? []).map(it => {
    const p = prodMap.get(it.productId);
    const name = p?.name ?? `Producto #${it.productId}`;
    const price = Number(p?.price) || 0;
    const qty = Number(it.quantity) || 0;
    const subtotal = price * qty;
    return { name, price, qty, subtotal };
  });
  const total = rows.reduce((acc, r) => acc + r.subtotal, 0);

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Cotización #${q.id}</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Helvetica Neue', sans-serif; padding: 24px; }
        h1 { margin: 0 0 8px; }
        .muted { color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background: #f3f4f6; }
        .total { text-align: right; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Cotización #${q.id}</h1>
      <div class="muted">Fecha: ${new Date(q.createdAt).toLocaleString()}</div>
      <div class="muted">Cliente: ${q.customerName} (${q.customerEmail})</div>
      <div class="muted">Estado: ${q.status}</div>
      ${q.notes ? `<div class="muted">Notas: ${q.notes}</div>` : ''}
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Precio</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `<tr><td>${r.name}</td><td>${r.qty}</td><td>$${formatMoney(r.price)}</td><td>$${formatMoney(r.subtotal)}</td></tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="total">Total</td>
            <td>$${formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
      <script>window.print()</script>
    </body>
  </html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export default function MisPedidosPage() {
  const { loading: authLoading, user } = useAuth();
  const { lastEvent } = usePublicSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedQuoteId, setExpandedQuoteId] = useState<number | null>(null);

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const resolveComprobantePdf = (doc: any) =>
    doc?.pdfUrl ||
    doc?.enlace_pdf ||
    doc?.raw?.enlace_del_pdf ||
    doc?.raw?.enlace_pdf ||
    null;

  useEffect(() => {
    if (lastEvent && (lastEvent.name === "cotizaciones.updated" || lastEvent.name === "pedidos.updated")) {
      setRefreshKey((k) => k + 1);
    }
  }, [lastEvent]);

  useEffect(() => {
    if (authLoading) return;
    
    const token = requireAuthOrRedirect();
    if (!token) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'mis-pedidos/page.tsx:load',message:'loading data start',data:{},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const [ordersData, quotesData, productsData, contactosData] = await Promise.all([
          apiFetchAuth("/pedidos/mios").catch((e) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'mis-pedidos/page.tsx:load',message:'pedidos/mios error',data:{error:e?.message},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return [];
          }),
          apiFetchAuth("/cotizaciones/mias").catch((e) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'mis-pedidos/page.tsx:load',message:'cotizaciones/mias error',data:{error:e?.message,errorStr:String(e)},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return [];
          }),
          apiFetchAuth("/productos").catch(() => []),
          apiFetchAuth("/contactos/mios").catch(() => []),
        ]);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'mis-pedidos/page.tsx:load',message:'data loaded',data:{ordersCount:Array.isArray(ordersData)?ordersData.length:'not-array',quotesCount:Array.isArray(quotesData)?quotesData.length:'not-array',productsCount:Array.isArray(productsData)?productsData.length:'not-array'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const normalizeOrderItems = (raw: any): OrderItem[] => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw as OrderItem[];
          if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? (parsed as OrderItem[]) : [];
            } catch {
              return [];
            }
          }
          return [];
        };
        const normalizeItem = (it: any): OrderItem => {
          const price = Number(
            it?.price ??
              it?.precioUnitario ??
              it?.precio ??
              it?.unitPrice ??
              0,
          );
          const quantity = Number(it?.quantity ?? it?.cantidad ?? it?.qty ?? 0);
          return {
            productId: Number(it?.productId ?? it?.id ?? 0) || undefined,
            name: String(it?.name ?? it?.nombre ?? it?.producto ?? "Producto"),
            price,
            quantity,
            imageUrl: it?.imageUrl ?? it?.imagen ?? it?.image,
            thumbnailUrl: it?.thumbnailUrl ?? it?.thumb,
          };
        };
        const resolveComprobante = (notesRaw: any) => {
          if (!notesRaw) return null;
          try {
            const parsed =
              typeof notesRaw === "string" ? JSON.parse(notesRaw) : notesRaw;
            return parsed?.factura ?? parsed?.comprobante ?? null;
          } catch {
            return null;
          }
        };
        const normalizedOrders = Array.isArray(ordersData)
          ? ordersData.map((o: any) => ({
              ...o,
              items: normalizeOrderItems(o.items).map(normalizeItem),
              comprobante: resolveComprobante(o.notes),
            }))
          : [];
        setOrders(normalizedOrders);
        setQuotes(Array.isArray(quotesData) ? quotesData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setContactMessages(Array.isArray(contactosData) ? contactosData : []);
      } catch (e: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'mis-pedidos/page.tsx:load',message:'load error',data:{error:e?.message},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setError(e?.message ?? "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user, refreshKey]);

  const isImageAttachment = (url: string) => {
    if (!url) return false;
    if (url.startsWith("data:image")) return true;
    const clean = url.split("?")[0].split("#")[0];
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(clean);
  };

  const getMessagePriority = (msg: ContactMessage) => {
    const text = `${msg.mensaje ?? ""} ${msg.respuesta ?? ""}`.toLowerCase();
    const urgentWords = ["urgente", "hoy", "inmediato", "ahora", "asap", "ya", "crítico", "critico", "parado"];
    const mediumWords = ["cotización", "cotizacion", "precio", "costo", "instalacion", "instalación", "mantenimiento"];
    if (urgentWords.some((w) => text.includes(w))) return "alta";
    if (mediumWords.some((w) => text.includes(w))) return "media";
    return "baja";
  };

  const getQuoteUpdates = useMemo(() => {
    const map = new Map<number, ProgressUpdate[]>();
    quotes.forEach((q) => {
      const list = (q.progressUpdates ?? []).filter(
        (u) => u.approvalStatus !== "PENDING" && u.approvalStatus !== "REJECTED",
      );
      const sorted = [...list].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      map.set(q.id, sorted);
    });
    return map;
  }, [quotes]);
  const orderedMessages = useMemo(() => {
    return [...contactMessages].sort(
      (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
    );
  }, [contactMessages]);

  // Calcular totales de cotizaciones
  const pricesById: Record<number, number> = {};
  products.forEach((p) => {
    pricesById[p.id] = Number(p.price) || 0;
  });

  const quoteTotals: Record<number, number> = {};
  quotes.forEach((q) => {
    const total = (q.items ?? []).reduce(
      (acc, it) => acc + (pricesById[it.productId] || 0) * (Number(it.quantity) || 0),
      0
    );
    quoteTotals[q.id] = total;
  });

  if (authLoading || loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold mb-6">Mis pedidos y cotizaciones</h1>
        <p className="text-zinc-600">Cargando...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold mb-4">Mis pedidos y cotizaciones</h1>
        <p className="mb-4 text-zinc-700">Necesitas iniciar sesión para ver tus pedidos y cotizaciones.</p>
        <div className="flex gap-3">
          <Link href="/auth/login" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
            Iniciar sesión
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6">
        <h1 className="text-3xl font-bold mb-2 text-slate-900">Mis pedidos y cotizaciones</h1>
        <p className="text-slate-600">Gestiona tus pedidos, avances y mensajes del admin en un solo lugar.</p>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div id="mensajes-admin" className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Mis mensajes</h2>
            <p className="text-sm text-slate-500">
              Accede al historial completo y filtros avanzados en una vista dedicada.
            </p>
          </div>
          <Link
            href="/mis-mensajes"
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm"
          >
            Ver todos mis mensajes
          </Link>
        </div>

        {contactMessages.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-600">
            Aún no tienes mensajes.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {orderedMessages.slice(0, 3).map((msg) => {
              const prioridad = getMessagePriority(msg);
              const estado = msg.respuesta ? "Respondido" : "Pendiente";
              return (
                <div key={msg.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="text-sm text-slate-500">
                    {new Date(msg.creadoEn).toLocaleString("es-PE")}
                  </div>
                  <div className="font-semibold mt-1 line-clamp-2">{msg.mensaje}</div>
                  <div className="flex flex-wrap gap-2 text-[11px] mt-3">
                    <span className={`px-2 py-0.5 rounded-full border ${
                      prioridad === "alta"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : prioridad === "media"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}>
                      Prioridad {prioridad}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border ${
                      estado === "Respondido"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {estado}
                    </span>
                  </div>
                  <Link
                    href="/mis-mensajes"
                    className="inline-flex mt-4 px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Ver detalle
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
          <div className="text-sm text-slate-600 mb-1">Pedidos totales</div>
          <div className="text-3xl font-bold text-blue-700">{orders.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
          <div className="text-sm text-slate-600 mb-1">Cotizaciones activas</div>
          <div className="text-3xl font-bold text-emerald-700">
            {quotes.filter(q => q.status === 'NUEVA' || q.status === 'PENDIENTE' || q.status === 'EN_PROCESO').length}
          </div>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-5 shadow-sm">
          <div className="text-sm text-slate-600 mb-1">Cotizaciones totales</div>
          <div className="text-3xl font-bold text-purple-700">{quotes.length}</div>
        </div>
      </div>

      {/* Sección de Cotizaciones */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Mis Cotizaciones</h2>
          <Link 
            href="/cotizacion" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Nueva cotización
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-600 mb-4">Aún no has solicitado ninguna cotización.</p>
            <Link href="/cotizacion" className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
              Solicitar cotización
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quotes.map((q) => {
              const date = new Date(q.createdAt);
              const total = quoteTotals[q.id] || 0;
              const badge = statusBadgeClass(q.status as any);
              const updates = getQuoteUpdates.get(q.id) ?? [];
              const latestUpdate = updates[0];
              const expanded = expandedQuoteId === q.id;
              return (
                <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">Cotización #{q.id}</h3>
                      <p className="text-sm text-slate-500">{date.toLocaleDateString('es-PE', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${badge.bg} ${badge.border}`}>
                      {formatStatus(q.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 mb-1">Productos</p>
                      <p className="text-sm font-semibold">
                        {q.items?.length || 0} {q.items?.length === 1 ? 'producto' : 'productos'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-xs text-emerald-700 mb-1">Total estimado</p>
                      <p className="text-lg font-bold text-emerald-700">S/ {formatMoney(total)}</p>
                    </div>
                  </div>

                  {q.notes && (
                    <div className="mb-4 text-xs text-slate-500 line-clamp-2">{q.notes}</div>
                  )}

                  {latestUpdate?.message && (
                    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                      <div className="text-xs text-blue-700 font-semibold mb-1">Respuesta del admin</div>
                      <div className="text-sm text-slate-700">{latestUpdate.message}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {latestUpdate.createdAt ? new Date(latestUpdate.createdAt).toLocaleString("es-PE") : "—"}
                        {" · "}
                        {latestUpdate.author || latestUpdate.technician || "Admin"}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <Link 
                      href={`/cotizacion/${q.id}`}
                      className="flex-1 text-center px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Ver detalles
                    </Link>
                    <button
                      onClick={() => setExpandedQuoteId(expanded ? null : q.id)}
                      className="px-3 py-2 text-sm border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      {expanded ? "Ocultar avances" : "Ver avances"}
                    </button>
                    <button
                      onClick={() => printQuote(q, products)}
                      className="px-3 py-2 text-sm border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                      title="Imprimir PDF"
                    >
                      PDF
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <h4 className="font-semibold text-sm mb-2">Mensajes y avances del admin</h4>
                        {updates.length === 0 ? (
                          <p className="text-sm text-slate-500">Aún no hay avances registrados.</p>
                        ) : (
                          <div className="space-y-3">
                            {updates.map((u, idx) => {
                              const attachments = u.attachmentUrls ?? [];
                              const imageAttachments = attachments.filter(isImageAttachment);
                              const fileAttachments = attachments.filter((url) => !isImageAttachment(url));
                              return (
                                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">{u.message}</span>
                                    {u.status && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                        {formatStatus(u.status)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {u.createdAt ? new Date(u.createdAt).toLocaleString("es-PE") : "—"} · {u.author || u.technician || "Admin"}
                                  </div>

                                  {u.materialList && u.materialList.length > 0 && (
                                    <div className="mt-2 text-xs text-slate-600">
                                      <strong>Materiales:</strong>{" "}
                                      {u.materialList.map(m => `${m.name} (${m.quantity} ${m.unit})`).join(', ')}
                                    </div>
                                  )}

                                  {imageAttachments.length > 0 && (
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                      {imageAttachments.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                          <img
                                            src={url}
                                            alt={`avance ${i + 1}`}
                                            className="h-24 w-full object-cover rounded-lg border border-slate-200"
                                          />
                                        </a>
                                      ))}
                                    </div>
                                  )}

                                  {fileAttachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      {fileAttachments.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">
                                          Ver archivo {i + 1}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección de Pedidos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Mis Pedidos</h2>
          <Link 
            href="/catalogo" 
            className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm"
          >
            Ver catálogo
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-600 mb-4">Aún no has realizado ningún pedido.</p>
            <Link href="/catalogo" className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
              Ver catálogo
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const date = new Date(o.createdAt);
              const statusColors: Record<string, { bg: string; text: string }> = {
                PENDIENTE: { bg: 'bg-amber-100', text: 'text-amber-800' },
                PAGADO: { bg: 'bg-blue-100', text: 'text-blue-800' },
                ENVIADO: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
                CANCELADO: { bg: 'bg-red-100', text: 'text-red-800' },
              };
              const statusStyle = statusColors[o.status] || { bg: 'bg-zinc-100', text: 'text-zinc-800' };
              
              return (
                <div key={o.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">Pedido #{o.id}</h3>
                      <p className="text-sm text-slate-500">
                        {date.toLocaleDateString('es-PE', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                      {o.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-slate-600 mb-1">Total:</p>
                    <p className="text-xl font-bold text-emerald-600">S/ {formatMoney(computeTotal(o))}</p>
                  </div>

                  {o.shippingAddress && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                      <p className="text-sm font-medium mb-1">Dirección de envío:</p>
                      <p className="text-sm text-slate-700">{o.shippingAddress}</p>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Productos ({o.items.length}):</p>
                    <ul className="space-y-2">
                      {o.items.map((it, idx) => {
                        const product = it.productId ? productsById.get(it.productId) : undefined;
                        const img = getImageUrl(
                          it.imageUrl ||
                            it.thumbnailUrl ||
                            product?.imageUrl ||
                            product?.thumbnailUrl,
                        );
                        return (
                          <li
                            key={`${o.id}-${it.productId ?? "item"}-${idx}`}
                            className="flex items-center justify-between gap-3 text-sm py-2 border-b border-slate-100 last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={img}
                                alt={it.name}
                                className="h-12 w-12 rounded-lg object-cover border border-slate-200 bg-white"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/vercel.svg";
                                }}
                              />
                              <div className="text-slate-700">
                                <div className="font-medium">{it.name}</div>
                                <div className="text-xs text-slate-500">Cantidad: {it.quantity}</div>
                              </div>
                            </div>
                            <span className="font-medium">S/ {formatMoney(Number(it.price) || 0)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {resolveComprobantePdf(o.comprobante) && (
                    <div className="mt-3 text-xs">
                      <a
                        href={resolveComprobantePdf(o.comprobante)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-blue-700"
                      >
                        Ver comprobante Nubefact (PDF)
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
