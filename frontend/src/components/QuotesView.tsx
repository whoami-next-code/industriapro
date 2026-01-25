"use client";
import React, { useEffect, useMemo, useState, memo } from "react";
import Link from "next/link";
import { apiFetch, apiFetchAuth } from "@/lib/api";

type QuoteItem = { productId: number; quantity: number };
type Quote = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: QuoteItem[];
  status: "PENDIENTE" | "EN_PROCESO" | "ENVIADA" | "CERRADA" | "RECHAZADA" | string;
  notes?: string;
  createdAt: string | Date;
};
type Product = { id: number; name: string; price: number };

function formatMoney(n: number) {
  try {
    return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return (Math.round(n * 100) / 100).toFixed(2);
  }
}

function statusBadgeClass(status: Quote["status"]) {
  switch (status) {
    case 'PENDIENTE':
      return { bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'EN_PROCESO':
      return { bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'ENVIADA':
      return { bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'CERRADA':
      return { bg: 'bg-zinc-100', border: 'border-zinc-200' };
    case 'RECHAZADA':
      return { bg: 'bg-red-50', border: 'border-red-200' };
    default:
      return { bg: 'bg-zinc-100', border: 'border-zinc-200' };
  }
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

export interface QuotesViewProps {
  email?: string;
  pageSize?: number;
}

function QuotesViewBase({ email, pageSize = 20 }: QuotesViewProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"fecha"|"estado"|"total">("fecha");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const quotesEndpoint = "/api/cotizaciones/mias";
        const [allQuotes, prods] = await Promise.all([
          apiFetchAuth(quotesEndpoint),
          apiFetch('/api/productos'),
        ]);
        setProducts(Array.isArray(prods) ? prods : []);
        const list = Array.isArray(allQuotes) ? allQuotes : [];
        const normalizedEmail =
          email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ? email.toLowerCase()
            : null;
        const filtered = normalizedEmail
          ? list.filter(
              (q: Quote) =>
                q.customerEmail?.toLowerCase() === normalizedEmail,
            )
          : list;
        setQuotes(filtered);
        setPage(1);
      } catch (e: any) {
        setError(e?.message ?? 'Error cargando cotizaciones');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const pricesById = useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of products) map[p.id] = Number(p.price) || 0;
    return map;
  }, [products]);

  const quoteTotals = useMemo(() => {
    const out: Record<number, number> = {};
    for (const q of quotes) {
      const total = (q.items ?? []).reduce((acc, it) => acc + (pricesById[it.productId] || 0) * (Number(it.quantity) || 0), 0);
      out[q.id] = total;
    }
    return out;
  }, [quotes, pricesById]);

  const sortedQuotes = useMemo(() => {
    const arr = [...quotes];
    const order = ['PENDIENTE','EN_PROCESO','ENVIADA','CERRADA','RECHAZADA'];
    arr.sort((a,b) => {
      if (sortBy === 'fecha') {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortDir === 'asc' ? da - db : db - da;
      } else if (sortBy === 'estado') {
        const ia = order.indexOf(a.status);
        const ib = order.indexOf(b.status);
        return sortDir === 'asc' ? ia - ib : ib - ia;
      } else {
        const ta = quoteTotals[a.id] || 0;
        const tb = quoteTotals[b.id] || 0;
        return sortDir === 'asc' ? ta - tb : tb - ta;
      }
    });
    return arr;
  }, [quotes, sortBy, sortDir, quoteTotals]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedQuotes.length / pageSize)), [sortedQuotes, pageSize]);
  const pageQuotes = useMemo(() => sortedQuotes.slice((page - 1) * pageSize, page * pageSize), [sortedQuotes, page, pageSize]);
  useEffect(() => { setPage(1); }, [sortBy, sortDir, quotes.length, pageSize]);

  return (
    <div>
      {loading && <p>Cargando cotizaciones...</p>}
      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
          {error}
        </div>
      )}

      {!loading && !error && quotes.length === 0 && (
        <div className="text-zinc-600 mb-6">No hay cotizaciones disponibles.</div>
      )}

      {!loading && !error && quotes.length > 0 && (
        <>
          <div className="mb-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <div className="text-sm text-zinc-600">Mostrando {sortedQuotes.length} cotizaciones</div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span>Ordenar por</span>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="border rounded px-3 py-2">
                  <option value="fecha">Fecha</option>
                  <option value="estado">Estado</option>
                  <option value="total">Total</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span>Dirección</span>
                <select value={sortDir} onChange={e=>setSortDir(e.target.value as any)} className="border rounded px-3 py-2">
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button disabled={page<=1} onClick={()=>setPage(1)} className="px-2 py-1 border rounded text-sm disabled:opacity-50">«</button>
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 border rounded text-sm disabled:opacity-50">‹</button>
              <span className="text-sm">Página {page} / {totalPages}</span>
              <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-2 py-1 border rounded text-sm disabled:opacity-50">›</button>
              <button disabled={page>=totalPages} onClick={()=>setPage(totalPages)} className="px-2 py-1 border rounded text-sm disabled:opacity-50">»</button>
            </div>
          </div>

          {/* Tabla para pantallas medianas y grandes */}
          <div className="overflow-x-auto hidden md:block">
            <table className="min-w-full border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border text-left">#</th>
                  <th className="p-2 border text-left">Fecha</th>
                  <th className="p-2 border text-left">Cliente</th>
                  <th className="p-2 border text-left">Estado</th>
                  <th className="p-2 border text-left">Total</th>
                  <th className="p-2 border text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageQuotes.map(q => {
                  const date = new Date(q.createdAt);
                  const total = quoteTotals[q.id] || 0;
                  const badge = statusBadgeClass(q.status as any);
                  return (
                    <tr key={q.id} className="align-top">
                      <td className="p-2 border text-sm">{q.id}</td>
                      <td className="p-2 border text-sm">{date.toLocaleString()}</td>
                      <td className="p-2 border text-sm">{q.customerName}<br/><span className="text-zinc-500">{q.customerEmail}</span></td>
                      <td className="p-2 border text-sm"><span className={`px-2 py-1 text-xs rounded border ${badge.bg} ${badge.border}`}>{q.status}</span></td>
                      <td className="p-2 border text-sm">${formatMoney(total)}</td>
                      <td className="p-2 border text-sm">
                        <div className="flex gap-2">
                          <Link href={`/cotizacion/${q.id}`} className="underline">Ver detalles</Link>
                          <button onClick={() => printQuote(q, products)} className="underline text-blue-700">PDF</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas para móviles */}
          <ul className="md:hidden space-y-3">
            {pageQuotes.map(q => {
              const date = new Date(q.createdAt);
              const total = quoteTotals[q.id] || 0;
              const badge = statusBadgeClass(q.status as any);
              return (
                <li key={q.id} className="border rounded p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-zinc-600">Cotización #{q.id}</p>
                      <p className="text-xs text-zinc-500">{date.toLocaleString()}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded border ${badge.bg} ${badge.border}`}>{q.status}</span>
                  </div>
                  <div className="text-sm mb-2">
                    <p className="font-medium">{q.customerName}</p>
                    <p className="text-zinc-500">{q.customerEmail}</p>
                  </div>
                  <div className="text-sm font-medium mb-2">Total: ${formatMoney(total)}</div>
                  <div className="flex gap-3 text-sm">
                    <Link href={`/cotizacion/${q.id}`} className="underline">Ver detalles</Link>
                    <button onClick={() => printQuote(q, products)} className="underline text-blue-700">PDF</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
  </div>
  );
}

export default memo(QuotesViewBase);
