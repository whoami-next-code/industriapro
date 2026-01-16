"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetchAuth, requireAuthOrRedirect } from "@/lib/api";
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

type OrderItem = { productId: number; name: string; price: number; quantity: number };
type Order = {
  id: number;
  userId?: number;
  items: OrderItem[];
  total: number;
  status: "PENDIENTE" | "PAGADO" | "ENVIADO" | "CANCELADO";
  shippingAddress?: string;
  createdAt: string | Date;
};

type QuoteItem = { productId: number; quantity: number };
type Quote = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: QuoteItem[];
  status: "PENDIENTE" | "NUEVA" | "EN_PROCESO" | "ENVIADA" | "COMPLETADA" | "CERRADA" | "RECHAZADA" | string;
  notes?: string;
  createdAt: string | Date;
  progressUpdates?: Array<{ materialList?: Array<{ name: string; quantity: number; unit: string }> }>;
};
type Product = { id: number; name: string; price: number };

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
        const [ordersData, quotesData, productsData] = await Promise.all([
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
        ]);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'mis-pedidos/page.tsx:load',message:'data loaded',data:{ordersCount:Array.isArray(ordersData)?ordersData.length:'not-array',quotesCount:Array.isArray(quotesData)?quotesData.length:'not-array',productsCount:Array.isArray(productsData)?productsData.length:'not-array'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setQuotes(Array.isArray(quotesData) ? quotesData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
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
          <Link href="/auth/register" className="px-4 py-2 border border-zinc-300 rounded hover:bg-zinc-50 transition-colors">
            Registrarme
          </Link>
        </div>
      </section>
    );
  }

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

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mis pedidos y cotizaciones</h1>
        <p className="text-zinc-600">Gestiona tus pedidos y solicitudes de cotización</p>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-zinc-600 mb-1">Pedidos totales</div>
          <div className="text-2xl font-bold text-emerald-600">{orders.length}</div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-zinc-600 mb-1">Cotizaciones activas</div>
          <div className="text-2xl font-bold text-blue-600">
            {quotes.filter(q => q.status === 'NUEVA' || q.status === 'PENDIENTE' || q.status === 'EN_PROCESO').length}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-zinc-600 mb-1">Cotizaciones totales</div>
          <div className="text-2xl font-bold text-zinc-700">{quotes.length}</div>
        </div>
      </div>

      {/* Sección de Cotizaciones */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Mis Cotizaciones</h2>
          <Link 
            href="/cotizacion" 
            className="px-4 py-2 bg-black text-white rounded hover:bg-zinc-800 transition-colors text-sm"
          >
            Nueva cotización
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-8 text-center">
            <p className="text-zinc-600 mb-4">Aún no has solicitado ninguna cotización.</p>
            <Link href="/cotizacion" className="inline-block px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
              Solicitar cotización
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotes.map((q) => {
              const date = new Date(q.createdAt);
              const total = quoteTotals[q.id] || 0;
              const badge = statusBadgeClass(q.status as any);
              return (
                <div key={q.id} className="bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">Cotización #{q.id}</h3>
                      <p className="text-sm text-zinc-500">{date.toLocaleDateString('es-PE', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${badge.bg} ${badge.border}`}>
                      {formatStatus(q.status)}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm text-zinc-600 mb-1">Productos:</p>
                    <p className="text-sm font-medium">
                      {q.items?.length || 0} {q.items?.length === 1 ? 'producto' : 'productos'}
                    </p>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-zinc-600 mb-1">Total estimado:</p>
                    <p className="text-xl font-bold text-emerald-600">S/ {formatMoney(total)}</p>
                  </div>

                  {q.notes && (
                    <div className="mb-4">
                      <p className="text-xs text-zinc-500 line-clamp-2">{q.notes}</p>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm text-zinc-600 mb-1">Materiales Recientes:</p>
                    <ul className="text-xs text-zinc-500 list-disc list-inside">
                      {q.progressUpdates?.[0]?.materialList?.map((mat, i) => (
                        <li key={i}>{mat.name} ({mat.quantity} {mat.unit})</li>
                      ))}
                      {!q.progressUpdates?.[0]?.materialList?.length && <li>No hay materiales registrados.</li>}
                    </ul>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    <Link 
                      href={`/cotizacion/${q.id}`}
                      className="flex-1 text-center px-3 py-2 text-sm bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                    >
                      Ver detalles
                    </Link>
                    <button
                      onClick={() => printQuote(q, products)}
                      className="px-3 py-2 text-sm border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
                      title="Imprimir PDF"
                    >
                      PDF
                    </button>
                  </div>
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
            className="px-4 py-2 border border-zinc-300 rounded hover:bg-zinc-50 transition-colors text-sm"
          >
            Ver catálogo
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-8 text-center">
            <p className="text-zinc-600 mb-4">Aún no has realizado ningún pedido.</p>
            <Link href="/catalogo" className="inline-block px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
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
                <div key={o.id} className="bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">Pedido #{o.id}</h3>
                      <p className="text-sm text-zinc-500">
                        {date.toLocaleDateString('es-PE', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded ${statusStyle.bg} ${statusStyle.text}`}>
                      {o.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-zinc-600 mb-1">Total:</p>
                    <p className="text-xl font-bold text-emerald-600">S/ {formatMoney(computeTotal(o))}</p>
                  </div>

                  {o.shippingAddress && (
                    <div className="mb-4 p-3 bg-zinc-50 rounded">
                      <p className="text-sm font-medium mb-1">Dirección de envío:</p>
                      <p className="text-sm text-zinc-700">{o.shippingAddress}</p>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Productos ({o.items.length}):</p>
                    <ul className="space-y-2">
                      {o.items.map((it, idx) => (
                        <li key={`${o.id}-${it.productId}-${idx}`} className="flex justify-between text-sm py-1 border-b border-zinc-100 last:border-0">
                          <span>{it.name} × {it.quantity}</span>
                          <span className="font-medium">S/ {formatMoney(Number(it.price) || 0)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
