"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetchAuth, requireAuthOrRedirect } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicSocket } from "@/lib/PublicSocketProvider";

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
  reportes?: Array<{
    message: string;
    found?: string;
    resolved?: string;
    evidenceUrls?: string[];
    createdAt: string;
    technicianName?: string;
  }>;
};

export default function MisMensajesPage() {
  const { loading: authLoading, user } = useAuth();
  const { lastEvent } = usePublicSocket();
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [messageQuery, setMessageQuery] = useState("");
  const [messageTab, setMessageTab] = useState<"all" | "unread" | "pending" | "urgent">("all");
  const [messagePage, setMessagePage] = useState(1);
  const [readMessageIds, setReadMessageIds] = useState<number[]>([]);

  useEffect(() => {
    if (lastEvent && lastEvent.name === "contactos.updated") {
      setRefreshKey((k) => k + 1);
    }
  }, [lastEvent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("mis-mensajes:contacto-read");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadMessageIds(parsed.filter((n) => Number.isFinite(n)));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("mis-mensajes:contacto-read", JSON.stringify(readMessageIds));
  }, [readMessageIds]);

  useEffect(() => {
    if (authLoading) return;
    const token = requireAuthOrRedirect();
    if (!token) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const data = await apiFetchAuth("/contactos/mios").catch(() => []);
        setContactMessages(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando mensajes");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authLoading, user, refreshKey]);

  const isUnreadMessage = (msg: ContactMessage) => {
    if (!msg.respuesta) return false;
    return !readMessageIds.includes(msg.id);
  };

  const getMessagePriority = (msg: ContactMessage) => {
    const text = `${msg.mensaje ?? ""} ${msg.respuesta ?? ""}`.toLowerCase();
    const urgentWords = ["urgente", "hoy", "inmediato", "ahora", "asap", "ya", "crítico", "critico", "parado"];
    const mediumWords = ["cotización", "cotizacion", "precio", "costo", "instalacion", "instalación", "mantenimiento"];
    if (urgentWords.some((w) => text.includes(w))) return "alta";
    if (mediumWords.some((w) => text.includes(w))) return "media";
    return "baja";
  };

  const isImageUrl = (url: string) => {
    const clean = url.split("?")[0].split("#")[0];
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(clean);
  };

  useEffect(() => {
    setMessagePage(1);
  }, [messageQuery, messageTab]);

  const unreadCount = useMemo(
    () => contactMessages.filter((m) => isUnreadMessage(m)).length,
    [contactMessages, readMessageIds],
  );
  const pendingCount = useMemo(
    () => contactMessages.filter((m) => !m.respuesta).length,
    [contactMessages],
  );
  const urgentCount = useMemo(
    () => contactMessages.filter((m) => getMessagePriority(m) === "alta").length,
    [contactMessages],
  );

  const filteredMessages = useMemo(() => {
    const q = messageQuery.trim().toLowerCase();
    let list = [...contactMessages];
    if (q) {
      list = list.filter((m) => {
        const hay = `${m.mensaje ?? ""} ${m.respuesta ?? ""} ${m.respondidoPor ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (messageTab === "unread") {
      list = list.filter((m) => isUnreadMessage(m));
    } else if (messageTab === "pending") {
      list = list.filter((m) => !m.respuesta);
    } else if (messageTab === "urgent") {
      list = list.filter((m) => getMessagePriority(m) === "alta");
    }
    list.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
    return list;
  }, [contactMessages, messageQuery, messageTab, readMessageIds]);

  const pageSize = 6;
  const totalMessagePages = Math.max(1, Math.ceil(filteredMessages.length / pageSize));
  const pagedMessages = filteredMessages.slice((messagePage - 1) * pageSize, messagePage * pageSize);

  useEffect(() => {
    if (messagePage > totalMessagePages) {
      setMessagePage(totalMessagePages);
    }
  }, [messagePage, totalMessagePages]);

  if (authLoading || loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-semibold mb-4">Mis mensajes</h1>
        <p className="text-slate-600">Cargando...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-semibold mb-4">Mis mensajes</h1>
        <p className="mb-4 text-zinc-700">Necesitas iniciar sesión para ver tus mensajes.</p>
        <div className="flex gap-3">
          <Link href="/auth/login" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
            Iniciar sesión
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mis mensajes</h1>
          <p className="text-slate-600 mt-1">Centro de comunicaciones y reportes técnicos.</p>
        </div>
        <Link
          href="/mis-pedidos"
          className="inline-flex items-center justify-center px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm"
        >
          Volver a mis pedidos
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{contactMessages.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">No leídos</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{unreadCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pendientes</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{pendingCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-4">
        <aside className="space-y-3 h-fit">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Categorías</div>
              <span className="text-[11px] text-slate-400">Vista rápida</span>
            </div>
            <div className="space-y-2">
              {[
                { id: "all", label: "Todos", count: contactMessages.length },
                { id: "unread", label: "No leídos", count: unreadCount },
                { id: "pending", label: "Sin respuesta", count: pendingCount },
                { id: "urgent", label: "Urgentes", count: urgentCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMessageTab(tab.id as typeof messageTab)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm border transition-all ${
                    messageTab === tab.id
                      ? "bg-blue-50 border-blue-200 text-blue-800 shadow-sm"
                      : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <span className="font-medium">{tab.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    messageTab === tab.id
                      ? "bg-white/70 border-blue-200 text-blue-700"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtros</div>
              <span className="text-[11px] text-slate-400">Buscar</span>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por contenido o respuesta..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={messageQuery}
                onChange={(e) => setMessageQuery(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
            </div>
          </div>
        </aside>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {contactMessages.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-600">
              Aún no tienes mensajes. Cuando nos escribas, aparecerán aquí.
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-600">
              No hay mensajes con los filtros aplicados.
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                {pagedMessages.map((msg) => {
                  const isExpanded = expandedContactId === msg.id;
                  const unread = isUnreadMessage(msg);
                  const prioridad = getMessagePriority(msg);
                  const estado = msg.respuesta ? "Respondido" : "Pendiente";
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-2xl border p-5 shadow-sm transition-colors ${
                        unread ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="space-y-2">
                            <div className="text-sm text-slate-500">
                              {new Date(msg.creadoEn).toLocaleString("es-PE")}
                            </div>
                            <div className="font-semibold text-slate-900">{msg.mensaje}</div>
                            <div className="flex flex-wrap gap-2 text-[11px]">
                            {unread && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                No leído
                              </span>
                            )}
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
                        </div>
                          <button
                            className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                            onClick={() => {
                              setExpandedContactId(isExpanded ? null : msg.id);
                              if (!isExpanded && msg.respuesta && !readMessageIds.includes(msg.id)) {
                                setReadMessageIds((prev) => [...prev, msg.id]);
                              }
                            }}
                          >
                            {isExpanded ? "Ocultar respuesta" : msg.respuesta ? "Ver respuesta" : "Ver detalle"}
                          </button>
                        </div>
                        {msg.respuesta && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>Respondido por {msg.respondidoPor || "Admin"}</span>
                            <span>•</span>
                            <span>{msg.respondidoEn ? new Date(msg.respondidoEn).toLocaleString("es-PE") : "—"}</span>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                          <div className="text-xs text-blue-700 font-semibold mb-1">Respuesta del admin</div>
                          <div className="text-sm text-slate-700 whitespace-pre-line">
                            {msg.respuesta || "Aún no hay respuesta registrada."}
                          </div>
                          {msg.reportes && msg.reportes.length > 0 && (
                            <div className="mt-4 border-t border-blue-100 pt-4 space-y-3">
                              <div className="text-xs text-blue-700 font-semibold">Reporte técnico</div>
                              {msg.reportes.map((r, idx) => (
                                <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="text-[11px] text-slate-500">
                                    {new Date(r.createdAt).toLocaleString("es-PE")} · {r.technicianName || "Técnico"}
                                  </div>
                                  <div className="text-sm font-semibold mt-1">{r.message}</div>
                                  {r.found && (
                                    <div className="text-xs text-slate-600 mt-1">
                                      <strong>Cómo se encontró:</strong> {r.found}
                                    </div>
                                  )}
                                  {r.resolved && (
                                    <div className="text-xs text-slate-600 mt-1">
                                      <strong>Cómo quedó:</strong> {r.resolved}
                                    </div>
                                  )}
                                  {r.evidenceUrls && r.evidenceUrls.length > 0 && (
                                    <div className="mt-2">
                                      <div className="text-xs font-semibold text-slate-500">Evidencias</div>
                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                        {r.evidenceUrls.map((u, i) => (
                                          <a key={i} href={u} target="_blank" rel="noreferrer" className="block">
                                            {isImageUrl(u) ? (
                                              <img
                                                src={u}
                                                alt="evidencia"
                                                className="h-24 w-full object-cover rounded border"
                                              />
                                            ) : (
                                              <div className="text-[11px] underline break-all">{u}</div>
                                            )}
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-500">
                  Página {messagePage} de {totalMessagePages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => setMessagePage((p) => Math.max(1, p - 1))}
                    disabled={messagePage === 1}
                  >
                    Anterior
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => setMessagePage((p) => Math.min(totalMessagePages, p + 1))}
                    disabled={messagePage >= totalMessagePages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
