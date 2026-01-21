"use client";

import React, { useEffect, useMemo, useState } from "react";
import Protected from "@/lib/Protected";
import { apiFetch } from "@/lib/api";
import Modal from "@/components/modals/Modal";

type Contacto = {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
  estado: "nuevo" | "en_proceso" | "atendido" | "cancelado";
  creadoEn: string;
  technicianId?: number;
  technicianName?: string;
  technicianEmail?: string;
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

export default function ReporteTecnicoPage() {
  const [items, setItems] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contacto | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const cargar = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Contacto[]>("/contactos");
      const list = Array.isArray(data) ? data : [];
      setItems(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar tareas técnicas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const tareasAsignadas = useMemo(
    () => items.filter((c) => Boolean(c.technicianId || c.technicianEmail || c.technicianName)),
    [items],
  );

  const progressFor = (c: Contacto) => {
    if (c.estado === "atendido") return 100;
    if (c.estado === "en_proceso") return 60;
    if (c.estado === "cancelado") return 0;
    return (c.reportes?.length ?? 0) > 0 ? 40 : 0;
  };

  const isImageUrl = (url: string) => {
    const clean = url.split("?")[0].split("#")[0];
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(clean);
  };

  const openReports = (contacto: Contacto) => {
    setSelected(contacto);
    setReportModalOpen(true);
  };

  const actualizarEstado = async (id: number, estado: Contacto["estado"]) => {
    try {
      await apiFetch(`/contactos/${id}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado }),
      });
      await cargar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error actualizando estado");
    }
  };

  return (
    <Protected>
      <div className="p-4 space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Bandeja de tareas técnicas</h1>
          <p className="text-sm sp-muted">
            Solo solicitudes asignadas a técnicos, con progreso y estado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sp-widget sp-widget-primary">
            <p className="text-sm sp-muted">Asignadas</p>
            <p className="text-2xl font-bold mt-1">{tareasAsignadas.length}</p>
          </div>
          <div className="sp-widget sp-widget-secondary">
            <p className="text-sm sp-muted">En proceso</p>
            <p className="text-2xl font-bold mt-1">
              {tareasAsignadas.filter((c) => c.estado === "en_proceso").length}
            </p>
          </div>
          <div className="sp-widget sp-widget-accent">
            <p className="text-sm sp-muted">Atendidas</p>
            <p className="text-2xl font-bold mt-1">
              {tareasAsignadas.filter((c) => c.estado === "atendido").length}
            </p>
          </div>
        </div>

        {error && <div className="mb-3 p-2 sp-badge sp-badge--accent">{error}</div>}
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="sp-table">
              <thead>
                <tr>
                  <th className="text-left">Cliente</th>
                  <th className="text-left">Técnico</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left">Avance</th>
                  <th className="text-left">Mensaje</th>
                  <th className="text-left">Reportes</th>
                  <th className="text-left">Acciones</th>
                  <th className="text-left">Creado</th>
                </tr>
              </thead>
              <tbody>
                {tareasAsignadas.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="text-sm">
                      <div className="font-medium">{c.nombre}</div>
                      <div className="text-xs sp-muted">{c.email}</div>
                      {c.telefono && <div className="text-xs sp-muted">{c.telefono}</div>}
                    </td>
                    <td className="text-sm">
                      <div className="font-medium">{c.technicianName || "—"}</div>
                      <div className="text-xs sp-muted">{c.technicianEmail || ""}</div>
                    </td>
                    <td className="text-sm">
                      <span className={`sp-badge ${
                        c.estado === "atendido"
                          ? "sp-badge--secondary"
                          : c.estado === "en_proceso"
                            ? "sp-badge--primary"
                            : "sp-badge--accent"
                      }`}>
                        {c.estado}
                      </span>
                      <div className="mt-2">
                        <select
                          className="sp-select text-sm"
                          value={c.estado}
                          onChange={(e) => actualizarEstado(c.id, e.target.value as Contacto["estado"])}
                        >
                          {ESTADOS.map((e) => (
                            <option key={e} value={e}>{e}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="text-sm">
                      <div className="w-32">
                        <div className="h-2 bg-[var(--surface-2)] rounded-full">
                          <div
                            className="h-2 bg-[var(--brand-primary)] rounded-full"
                            style={{ width: `${progressFor(c)}%` }}
                          />
                        </div>
                        <div className="text-xs text-center mt-1">{progressFor(c)}%</div>
                      </div>
                    </td>
                    <td className="text-sm max-w-xs break-words">{c.mensaje}</td>
                    <td className="text-sm">
                      {(c.reportes?.length ?? 0)} reporte(s)
                    </td>
                    <td className="text-sm">
                      <button
                        onClick={() => openReports(c)}
                        className="sp-button sp-button-outline text-xs"
                      >
                        Ver reportes
                      </button>
                    </td>
                    <td className="text-sm">{new Date(c.creadoEn).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={`Reportes técnicos de ${selected?.nombre ?? ""}`}
        size="lg"
      >
        <div className="space-y-4">
          {selected?.reportes?.length ? (
            <div className="space-y-3">
              {selected.reportes.map((r, idx) => (
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
                        {r.evidenceUrls.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className="block">
                            {isImageUrl(u) ? (
                              <img src={u} alt="evidencia" className="h-24 w-full object-cover rounded border" />
                            ) : (
                              <div className="text-xs underline break-all">{u}</div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="sp-muted text-sm">Sin reportes registrados.</div>
          )}
        </div>
      </Modal>
    </Protected>
  );
}
