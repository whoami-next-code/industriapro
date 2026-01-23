"use client";
import React, { useEffect, useState } from "react";
import Protected from "@/lib/Protected";
import { apiFetch, API_URL } from "@/lib/api";
import AiAnalysisModal from "@/components/modals/AiAnalysisModal";
import Modal from "@/components/modals/Modal";
import { SparklesIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

type Contacto = {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
  respuesta?: string;
  respondidoEn?: string;
  respondidoPor?: string;
  productoId?: number;
  estado: "nuevo" | "en_proceso" | "atendido" | "cancelado";
  creadoEn: string;
  technicianId?: number;
  technicianName?: string;
  technicianEmail?: string;
  technicianPhone?: string;
  reportes?: Array<{
    message: string;
    found?: string;
    resolved?: string;
    evidenceUrls?: string[];
    createdAt: string;
    technicianName?: string;
  }>;
};

const ESTADOS: Contacto["estado"][] = ["nuevo", "en_proceso", "atendido", "cancelado"];

type TechnicianWorkload = {
  id: number;
  fullName: string;
  email: string;
  activeCount: number;
  status: 'DISPONIBLE' | 'EN_PROCESO' | 'SATURADO';
};

export default function AdminContactosPage({ title = "Servicios técnicos" }: { title?: string }) {
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL ?? "http://localhost:3000";
  const [items, setItems] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianWorkload[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<number | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contacto | null>(null);
  
  // Estado para Modal de IA
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedContacto, setSelectedContacto] = useState<Contacto | null>(null);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const openAiAnalysis = (contacto: Contacto) => {
    setSelectedContacto(contacto);
    setAiModalOpen(true);
  };

  const openReply = (contacto: Contacto) => {
    setSelectedContacto(contacto);
    setReplyText(contacto.respuesta || "");
    setReplyModalOpen(true);
  };

  const openAssign = async (contacto: Contacto) => {
    setSelectedContacto(contacto);
    setSelectedTechId(contacto.technicianId ?? null);
    setAssignModalOpen(true);
    try {
      const data = await apiFetch<TechnicianWorkload[]>("/cotizaciones/workload");
      setTechnicians(Array.isArray(data) ? data : []);
    } catch {
      setTechnicians([]);
    }
  };

  const openReports = (contacto: Contacto) => {
    setSelectedContacto(contacto);
    setReportModalOpen(true);
  };

  const cargar = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    setCargando(true);
    setError(null);
    try {
      const data = await apiFetch<Contacto[]>("/contactos");
      setItems(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar contactos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const actualizarEstado = async (id: number, estado: Contacto["estado"]) => {
    setActualizandoId(id);
    try {
      await apiFetch(`/contactos/${id}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado }),
      });
      await cargar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error actualizando estado");
    } finally {
      setActualizandoId(null);
    }
  };

  const enviarRespuesta = async () => {
    if (!selectedContacto) return;
    if (!replyText.trim()) {
      alert("Escribe una respuesta antes de enviar.");
      return;
    }
    setSendingReply(true);
    try {
      await apiFetch(`/contactos/${selectedContacto.id}/respuesta`, {
        method: "PUT",
        body: JSON.stringify({ respuesta: replyText.trim() }),
      });
      await cargar();
      setReplyModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al enviar respuesta");
    } finally {
      setSendingReply(false);
    }
  };

  const asignarTecnico = async () => {
    if (!selectedContacto || !selectedTechId) return;
    setAssigningId(selectedContacto.id);
    try {
      await apiFetch(`/contactos/${selectedContacto.id}/asignar`, {
        method: "PUT",
        body: JSON.stringify({ technicianId: selectedTechId }),
      });
      await cargar();
      setAssignModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al asignar técnico");
    } finally {
      setAssigningId(null);
    }
  };

  const eliminarReporte = async (contactoId: number, index: number) => {
    if (!confirm("¿Eliminar este reporte técnico?")) return;
    try {
      await apiFetch(`/contactos/${contactoId}/reportes/${index}`, {
        method: "DELETE",
      });
      await cargar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar reporte");
    }
  };

  const solicitarEliminacion = (contacto: Contacto) => {
    setDeleteTarget(contacto);
    setDeleteModalOpen(true);
  };

  const confirmarEliminacion = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/contactos/${deleteTarget.id}`, { method: "DELETE" });
      await cargar();
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar mensaje");
    }
  };

  const isImageUrl = (url: string) => {
    const clean = url.split("?")[0].split("#")[0];
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(clean);
  };

  const normalizeEvidenceUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("http")) return url;
    const base = API_URL.replace(/\/api\/?$/, "");
    const clean = url.replace(/\\/g, "/").trim();
    return `${base}${clean.startsWith("/") ? "" : "/"}${clean}`;
  };

  return (
    <Protected>
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm sp-muted">
          Gestiona solicitudes de servicio técnico y reportes de atención.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sp-widget sp-widget-primary">
          <p className="text-sm sp-muted">Solicitudes</p>
          <p className="text-2xl font-bold mt-1">{items.length}</p>
        </div>
        <div className="sp-widget sp-widget-secondary">
          <p className="text-sm sp-muted">Sin asignar</p>
          <p className="text-2xl font-bold mt-1">
            {items.filter((c) => !c.technicianId).length}
          </p>
        </div>
        <div className="sp-widget sp-widget-accent">
          <p className="text-sm sp-muted">Con reportes</p>
          <p className="text-2xl font-bold mt-1">
            {items.filter((c) => (c.reportes?.length ?? 0) > 0).length}
          </p>
        </div>
      </div>
      {error && <div className="mb-3 p-2 sp-badge sp-badge--accent">{error}</div>}
      {cargando ? (
        <div>Cargando...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="sp-table">
            <thead>
              <tr>
                <th className="text-left">ID</th>
                <th className="text-left">Nombre</th>
                <th className="text-left">Email</th>
                <th className="text-left">Teléfono</th>
                <th className="text-left">Producto</th>
                <th className="text-left">Mensaje</th>
                <th className="text-left">Respuesta</th>
                <th className="text-left">IA</th>
                <th className="text-left">Técnico</th>
                <th className="text-left">Acciones</th>
                <th className="text-left">Estado</th>
                <th className="text-left">Creado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="text-sm">{c.id}</td>
                  <td className="text-sm">{c.nombre}</td>
                  <td className="text-sm">{c.email}</td>
                  <td className="text-sm">{c.telefono || "-"}</td>
                  <td className="text-sm">{c.productoId ?? "-"}</td>
                  <td className="text-sm max-w-xs break-words">{c.mensaje}</td>
                  <td className="text-sm max-w-xs break-words">
                    {c.respuesta ? (
                      <div>
                        <div className="text-xs sp-muted">
                          {c.respondidoEn ? new Date(c.respondidoEn).toLocaleString() : "—"}
                        </div>
                        <div>{c.respuesta}</div>
                      </div>
                    ) : (
                      <span className="sp-muted">Sin respuesta</span>
                    )}
                  </td>
                  <td className="text-sm">
                    <button
                      onClick={() => openAiAnalysis(c)}
                      className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                      title="Analizar con IA"
                    >
                      <SparklesIcon className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="text-sm">
                    <div className="text-xs">
                      {c.technicianName ? (
                        <>
                          <div className="font-semibold">{c.technicianName}</div>
                          <div className="sp-muted">{c.technicianEmail}</div>
                        </>
                      ) : (
                        <span className="sp-muted">Sin asignar</span>
                      )}
                    </div>
                  </td>
                  <td className="text-sm">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openReply(c)}
                        className="sp-button sp-button-outline text-xs"
                      >
                        Responder
                      </button>
                      <button
                        onClick={() => openAssign(c)}
                        className="sp-button sp-button-outline text-xs"
                      >
                        Asignar
                      </button>
                      <button
                        onClick={() => openReports(c)}
                        className="sp-button sp-button-outline text-xs"
                      >
                        Reportes
                      </button>
                      <button
                        onClick={() => solicitarEliminacion(c)}
                        className="sp-button sp-button-outline text-xs text-rose-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                  <td className="text-sm">
                    <span className={`sp-badge ${
                      c.estado === 'atendido'
                        ? 'sp-badge--secondary'
                        : c.estado === 'en_proceso'
                          ? 'sp-badge--primary'
                          : c.estado === 'cancelado'
                            ? 'sp-badge--accent'
                            : 'sp-badge--accent'
                    }`}>
                      {c.estado}
                    </span>
                    <div className="mt-2">
                      <select
                        className="sp-select text-sm"
                        value={c.estado}
                        onChange={(e) => actualizarEstado(c.id, e.target.value as Contacto["estado"]) }
                        disabled={actualizandoId === c.id}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="text-sm">{new Date(c.creadoEn).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    <AiAnalysisModal 
      isOpen={aiModalOpen} 
      onClose={() => setAiModalOpen(false)} 
      contacto={selectedContacto}
      onUseSuggestion={(text) => {
        if (!selectedContacto) return;
        setReplyText(text);
        setAiModalOpen(false);
        setReplyModalOpen(true);
      }}
    />
    <Modal
      isOpen={replyModalOpen}
      onClose={() => setReplyModalOpen(false)}
      title={`Responder a ${selectedContacto?.nombre ?? ""}`}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold">Mensaje del cliente</div>
          <div className="sp-panel text-sm sp-muted">
            {selectedContacto?.mensaje}
          </div>
        </div>
        {selectedContacto?.reportes && selectedContacto.reportes.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Último reporte técnico</div>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-500"
                onClick={() => {
                  const last = selectedContacto.reportes?.[selectedContacto.reportes.length - 1];
                  if (!last) return;
                  const resumen = [
                    "Reporte técnico:",
                    last.message ? `- Mensaje: ${last.message}` : "",
                    last.found ? `- Cómo se encontró: ${last.found}` : "",
                    last.resolved ? `- Cómo quedó: ${last.resolved}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n");
                  setReplyText((prev) => (prev ? `${prev}\n\n${resumen}` : resumen));
                }}
              >
                Agregar resumen
              </button>
            </div>
            {(() => {
              const last = selectedContacto.reportes?.[selectedContacto.reportes.length - 1];
              if (!last) return null;
              return (
                <div className="sp-panel text-sm mt-2 space-y-2">
                  <div className="text-xs sp-muted">
                    {new Date(last.createdAt).toLocaleString()} · {last.technicianName || "Técnico"}
                  </div>
                  <div className="font-semibold">{last.message}</div>
                  {last.found && (
                    <div className="text-sm sp-muted">
                      <strong>Cómo se encontró:</strong> {last.found}
                    </div>
                  )}
                  {last.resolved && (
                    <div className="text-sm sp-muted">
                      <strong>Cómo quedó:</strong> {last.resolved}
                    </div>
                  )}
                  {last.evidenceUrls && last.evidenceUrls.length > 0 && (
                    <div className="mt-2 text-sm">
                      <div className="font-medium">Evidencias</div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {last.evidenceUrls.map((u, i) => {
                          const normalized = normalizeEvidenceUrl(u);
                          return (
                            <a
                              key={i}
                              href={normalized}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              {isImageUrl(normalized) ? (
                              <img src={normalized} alt="evidencia" className="h-24 w-full object-cover rounded border" />
                            ) : (
                              <div className="text-xs underline break-all">{normalized}</div>
                            )}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <div>
          <label className="sp-form-label">Respuesta</label>
          <textarea
            className="sp-textarea"
            rows={6}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escribe la respuesta para el cliente..."
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="sp-button sp-button-outline"
            onClick={() => setReplyModalOpen(false)}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="sp-button sp-button-primary"
            onClick={enviarRespuesta}
            type="button"
            disabled={sendingReply}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {sendingReply ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </Modal>
    <Modal
      isOpen={assignModalOpen}
      onClose={() => setAssignModalOpen(false)}
      title={`Asignar técnico a ${selectedContacto?.nombre ?? ""}`}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="sp-form-label">Técnico</label>
          <select
            className="sp-select w-full"
            value={selectedTechId ?? ""}
            onChange={(e) => setSelectedTechId(Number(e.target.value) || null)}
          >
            <option value="">Selecciona un técnico</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName || t.email} · {t.activeCount ?? 0} tareas
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className="sp-button sp-button-outline" onClick={() => setAssignModalOpen(false)} type="button">
            Cancelar
          </button>
          <button
            className="sp-button sp-button-primary"
            onClick={asignarTecnico}
            type="button"
            disabled={!selectedTechId || assigningId === selectedContacto?.id}
          >
            {assigningId === selectedContacto?.id ? "Asignando..." : "Asignar"}
          </button>
        </div>
      </div>
    </Modal>
    <Modal
      isOpen={reportModalOpen}
      onClose={() => setReportModalOpen(false)}
      title={`Reportes técnicos de ${selectedContacto?.nombre ?? ""}`}
      size="lg"
    >
      <div className="space-y-4">
        {selectedContacto?.reportes?.length ? (
          <div className="space-y-3">
            {selectedContacto.reportes.map((r, idx) => (
              <div key={idx} className="sp-panel">
                <div className="text-xs sp-muted mb-1">
                  {new Date(r.createdAt).toLocaleString()} · {r.technicianName || "Técnico"}
                </div>
                <div className="text-sm font-semibold">{r.message}</div>
                {r.found && <div className="text-sm sp-muted mt-1"><strong>Cómo se encontró:</strong> {r.found}</div>}
                {r.resolved && <div className="text-sm sp-muted mt-1"><strong>Cómo quedó:</strong> {r.resolved}</div>}
                {r.evidenceUrls && r.evidenceUrls.length > 0 && (
                  <div className="mt-2 text-sm">
                    <div className="font-medium">Evidencias</div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {r.evidenceUrls.map((u, i) => {
                        const normalized = normalizeEvidenceUrl(u);
                        return (
                          <a key={i} href={normalized} target="_blank" rel="noreferrer" className="block">
                            {isImageUrl(normalized) ? (
                              <img src={normalized} alt="evidencia" className="h-24 w-full object-cover rounded border" />
                            ) : (
                              <div className="text-xs underline break-all">{normalized}</div>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    className="sp-button sp-button-outline text-xs"
                    onClick={() => eliminarReporte(selectedContacto.id, idx)}
                  >
                    Eliminar reporte
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="sp-muted text-sm">Sin reportes registrados.</div>
        )}
      </div>
    </Modal>
    <Modal
      isOpen={deleteModalOpen}
      onClose={() => setDeleteModalOpen(false)}
      title="Confirmar eliminación"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm">
          ¿Seguro que deseas eliminar el mensaje de{" "}
          <span className="font-semibold">{deleteTarget?.nombre ?? "el cliente"}</span>?
        </p>
        <p className="text-xs sp-muted">Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2">
          <button
            className="sp-button sp-button-outline"
            onClick={() => setDeleteModalOpen(false)}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="sp-button sp-button-primary"
            onClick={confirmarEliminacion}
            type="button"
          >
            Eliminar
          </button>
        </div>
      </div>
    </Modal>
    </Protected>
  );
}
