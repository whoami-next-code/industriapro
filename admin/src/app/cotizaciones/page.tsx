"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { apiFetch } from "@/lib/api";
import Protected from "@/lib/Protected";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Table, { Th, Td } from "@/components/ui/Table";
import Modal from "@/components/modals/Modal";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import { useAdminSocket } from "@/lib/AdminSocketProvider";
import toast from "react-hot-toast";

type QuoteStatus =
  | "PENDIENTE"
  | "APROBADA"
  | "PRODUCCION"
  | "INSTALACION"
  | "FINALIZADA"
  | "CANCELADA"
  | "NUEVA"
  | "EN_PROCESO"
  | "ENVIADA"
  | "ENTREGADA"
  | "COMPLETADA"
  | string;

type QuoteItem = {
  productId?: number;
  name?: string;
  quantity: number;
  materials?: string;
  measures?: string;
  observations?: string;
  imageUrl?: string;
};

type QuotationImage = {
  id: number;
  quotationId: number;
  userId: string;
  image_url: string;
  is_approved: boolean;
  uploaded_at: string;
  user?: {
    email: string;
    fullName?: string;
  };
};

type MaterialUsage = {
  name: string;
  quantity: number;
  unit: string;
  provider?: string;
};

type ProgressUpdate = {
  message: string;
  status?: QuoteStatus;
  estimatedDate?: string;
  attachmentUrls?: string[];
  materials?: string;
  materialList?: MaterialUsage[];
  createdAt: string;
  author?: string;
  channel?: string;
  progressPercent?: number;
  milestone?:
    | "INICIO"
    | "APROBADA"
    | "PRODUCCION"
    | "INSTALACION"
    | "ENTREGA"
    | "CIERRE";
  technician?: string;
  highlighted?: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  technicianSignature?: string;
  rejectionReason?: string;
  reviewedBy?: string;
};

type Quote = {
  id: number;
  code?: string;
  orderId?: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerDocument?: string;
  customerAddress?: string;
  items: QuoteItem[];
  status: QuoteStatus;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  need?: string;
  estimatedDate?: string;
  estimatedDeliveryDate?: string;
  startDate?: string;
  estimatedCompletionDate?: string;
  completionDate?: string;
  installationDate?: string;
  budget?: string;
  totalAmount?: number;
  preferredChannel?: string;
  technicianName?: string;
  technicianId?: number;
  installationTechnician?: string;
  technicianSignature?: string;
  notes?: string;
  clientMessage?: string;
  lastUpdateMessage?: string;
  progressPercent?: number;
  progressUpdates?: ProgressUpdate[];
  timeline?: ProgressUpdate[];
  updatedAt: string | Date;
  createdAt: string | Date;
};

type TechnicianWorkload = {
  id: number;
  fullName: string;
  email: string;
  activeCount: number;
  status: 'DISPONIBLE' | 'EN_PROCESO' | 'SATURADO';
};

type Filters = { search: string; status: string; from: string; to: string };

type Profile = { role?: string | null };

type QuoteListResponse = {
  data: Quote[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  stats?: { byStatus?: Record<string, number>; total?: number };
};

const STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "APROBADA", label: "Aprobada" },
  { value: "PRODUCCION", label: "En producción" },
  { value: "INSTALACION", label: "Instalación" },
  { value: "FINALIZADA", label: "Finalizada" },
  { value: "CANCELADA", label: "Cancelada" },
];

const CLIENT_BASE_URL = process.env.NEXT_PUBLIC_CLIENT_URL ?? "http://localhost:3000";

function AssignmentModal({ 
  isOpen, 
  onClose, 
  onAssign, 
  technicians 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAssign: (techId: number) => void; 
  technicians: TechnicianWorkload[] 
}) {
  const statusPriority = (status: string) => {
    if (status === "DISPONIBLE") return 0;
    if (status === "EN_PROCESO") return 1;
    if (status === "SATURADO") return 2;
    return 1;
  };
  const sortedTechs = [...technicians].sort((a, b) => {
    const scoreA = statusPriority(a.status) * 1000 + (a.activeCount ?? 0);
    const scoreB = statusPriority(b.status) * 1000 + (b.activeCount ?? 0);
    return scoreA - scoreB;
  });
  const recommended = sortedTechs[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asignación Inteligente de Personal">
      <div className="space-y-4">
        <p className="text-sm sp-muted mb-4">Seleccione un técnico disponible para asignar a esta cotización. El sistema sugiere personal basado en su carga actual.</p>
        {recommended && (
          <div className="sp-panel flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Recomendación automática</div>
              <div className="text-xs sp-muted">
                {recommended.fullName || recommended.email} · {recommended.activeCount ?? 0} tareas en curso
              </div>
            </div>
            <Button size="sm" onClick={() => onAssign(recommended.id)}>
              Asignar automáticamente
            </Button>
          </div>
        )}
        <div className="text-xs sp-muted">Ordenado por menor carga y disponibilidad.</div>
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {technicians.length === 0 ? (
          <div className="p-4 text-center sp-muted bg-[var(--surface-2)] rounded-xl">
            No se encontraron técnicos registrados con el rol TECNICO.
          </div>
        ) : (
          sortedTechs.map(tech => (
            <div key={tech.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-xl hover:bg-[var(--surface-2)] transition-colors">
              <div className="flex flex-col">
                <span className="font-medium">{tech.fullName || tech.email}</span>
                <div className="flex flex-col md:flex-row items-center gap-2 mb-4 text-xs mt-1">
                   <span className={`px-2 py-0.5 rounded-full font-medium ${
                     tech.status === 'DISPONIBLE' ? 'sp-badge sp-badge--secondary' :
                     tech.status === 'SATURADO' ? 'sp-badge sp-badge--accent' : 'sp-badge sp-badge--primary'
                   }`}>
                     {tech.status}
                   </span>
                   {recommended?.id === tech.id && (
                     <span className="sp-badge sp-badge--primary">Recomendado</span>
                   )}
                   <span className="sp-muted">• {tech.activeCount} tareas en curso</span>
                </div>
              </div>
              <Button 
                variant={tech.status === 'SATURADO' ? 'ghost' : 'primary'}
                onClick={() => onAssign(tech.id)}
                className="text-sm py-1 h-8"
              >
                Asignar
              </Button>
            </div>
          ))
        )}
        </div>
      </div>
    </Modal>
  );
}

export default function AdminCotizaciones() {
  const [items, setItems] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canView, setCanView] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [images, setImages] = useState<QuotationImage[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianWorkload[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { lastEvent } = useAdminSocket();

  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [apiStats, setApiStats] = useState<{ byStatus?: Record<string, number>; total?: number } | null>(null);
  const isImageAttachment = (url: string) => {
    if (!url) return false;
    if (url.startsWith("data:image")) return true;
    const clean = url.split("?")[0].split("#")[0];
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(clean);
  };

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const loadQuotes = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filters.status) qs.append("status", filters.status);
      if (filters.search) qs.append("q", filters.search);
      if (filters.from) qs.append("from", filters.from);
      if (filters.to) qs.append("to", filters.to);
      qs.append("page", String(page));
      qs.append("limit", String(pageSize));
      const url = `/cotizaciones${qs.toString() ? `?${qs.toString()}` : ""}`;
      const data = await apiFetch<Quote[] | QuoteListResponse>(url);
      setApiStats(null);

      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      } else if (data && typeof data === "object") {
        const list = Array.isArray((data as QuoteListResponse).data) ? (data as QuoteListResponse).data : [];
        const totalFromApi = Number((data as QuoteListResponse).total ?? list.length) || 0;
        const pageFromApi = Number((data as QuoteListResponse).page ?? page) || page;
        const pageSizeFromApi = Number((data as QuoteListResponse).pageSize ?? pageSize) || pageSize;
        const statsFromApi = (data as QuoteListResponse).stats;

        setItems(list);
        setTotal(totalFromApi);
        if (statsFromApi) {
          setApiStats({ ...statsFromApi, total: statsFromApi.total ?? totalFromApi });
        }
        if (pageFromApi !== page) setPage(pageFromApi);
        if (pageSizeFromApi !== pageSize) setPageSize(pageSizeFromApi);
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cargando cotizaciones";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [canView, filters.from, filters.search, filters.status, filters.to, page, pageSize]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<Profile>("/auth/profile")
      .then((p) => {
        setProfile(p);
        const allowed = p?.role === "ADMIN" || p?.role === "VENDEDOR";
        setCanView(allowed);
        if (!allowed) {
          setError("No tienes permisos para ver cotizaciones. Contacta a un administrador.");
          setLoading(false);
          return;
        }
        loadQuotes();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "No se pudo validar el usuario";
        setError(msg);
        setLoading(false);
      });
  }, [loadQuotes]);

  useEffect(() => {
    if (lastEvent?.name === 'cotizaciones.updated') {
      loadQuotes();
      if (selected) {
        const data = lastEvent.data as any;
        if (data && (data.id === selected.id || data.id === Number(selected.id))) {
           if (data.action === 'delete') {
             setSelected(null);
           } else {
             // Recargar detalle
             openDetail(selected); 
           }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  function statusColors(status: QuoteStatus) {
    const map: Record<string, { badge: string }> = {
      PENDIENTE: { badge: "sp-badge sp-badge--accent" },
      APROBADA: { badge: "sp-badge sp-badge--primary" },
      PRODUCCION: { badge: "sp-badge sp-badge--primary" },
      INSTALACION: { badge: "sp-badge sp-badge--accent" },
      FINALIZADA: { badge: "sp-badge sp-badge--secondary" },
      CANCELADA: { badge: "sp-badge sp-badge--accent" },
      NUEVA: { badge: "sp-badge sp-badge--accent" },
      EN_PROCESO: { badge: "sp-badge sp-badge--primary" },
      ENVIADA: { badge: "sp-badge sp-badge--primary" },
      ENTREGADA: { badge: "sp-badge sp-badge--secondary" },
      COMPLETADA: { badge: "sp-badge sp-badge--secondary" },
    };
    return map[status] || { badge: "sp-badge sp-badge--primary" };
  }

  function statusToPercent(status?: QuoteStatus) {
    const normalized = (status || "").toUpperCase();
    switch (normalized) {
      case "PENDIENTE":
      case "NUEVA":
        return 0;
      case "APROBADA":
      case "EN_PROCESO":
        return 20;
      case "PRODUCCION":
      case "EN_PRODUCCION":
        return 55;
      case "INSTALACION":
        return 85;
      case "FINALIZADA":
      case "COMPLETADA":
      case "ENTREGADA":
        return 100;
      default:
        return 10;
    }
  }

  function formatDate(date?: string | Date | null) {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-PE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatMoney(num?: number | string | null) {
    if (num === null || num === undefined) return "S/ 0.00";
    const value = Number(num);
    if (!Number.isFinite(value)) return "S/ 0.00";
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      minimumFractionDigits: 2,
    }).format(value);
  }

  async function fetchImages(quotationId: number) {
    setImageLoading(true);
    try {
      const data = await apiFetch<QuotationImage[]>(`/cotizaciones/${quotationId}/images`);
      setImages(data || []);
    } catch (err) {
      console.error("Error cargando imágenes", err);
    } finally {
      setImageLoading(false);
    }
  }

  async function loadWorkload() {
    try {
      const data = await apiFetch<TechnicianWorkload[]>('/cotizaciones/workload');
      setTechnicians(data || []);
    } catch (err) {
      console.error("Error loading workload", err);
    }
  }

  async function handleAssign(techId: number) {
    if (!selected) return;
    try {
      const updated = await apiFetch(`/cotizaciones/${selected.id}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ technicianId: techId })
      });
      setShowAssignModal(false);
      await loadQuotes();
      if (selected) openDetail({ ...selected, technicianId: techId }); // Refresh selected roughly
      const techName = (updated as any)?.technicianName || technicians.find(t => t.id === techId)?.fullName || 'técnico';
      toast.success(`Técnico asignado: ${techName}`);
    } catch (err) {
      toast.error('No se pudo asignar el técnico. Intenta nuevamente.');
    }
  }

  function openDeleteConfirm(quote: Quote) {
    setDeleteTarget(quote);
    setShowDeleteConfirm(true);
  }

  async function handleDeleteQuote() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/cotizaciones/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Cotización eliminada");
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
      }
      await loadQuotes();
    } catch (err) {
      toast.error("No se pudo eliminar la cotización");
    } finally {
      setDeleting(false);
    }
  }

  async function approveUpdate(updateIndex: number) {
    if (!selected) return;
    if (!confirm('¿Aprobar esta etapa y permitir el avance?')) return;
    try {
      await apiFetch(`/cotizaciones/${selected.id}/approve/${updateIndex}`, { method: 'PUT' });
      openDetail(selected); // Reload detail
      alert('Etapa aprobada');
    } catch (err) {
      alert('Error al aprobar etapa');
    }
  }

  async function rejectUpdate(updateIndex: number) {
    if (!selected) return;
    const reason = prompt('Motivo del rechazo (se notificará al técnico):');
    if (!reason) return;
    try {
      await apiFetch(`/cotizaciones/${selected.id}/reject/${updateIndex}`, { 
        method: 'PUT',
        body: JSON.stringify({ reason })
      });
      openDetail(selected); // Reload detail
      alert('Etapa rechazada');
    } catch (err) {
      alert('Error al rechazar etapa');
    }
  }

  async function approveImage(imageId: number) {
    try {
      await apiFetch(`/cotizaciones/images/${imageId}/approve`, { method: "PUT" });
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, is_approved: true } : img))
      );
    } catch (err) {
      alert("Error al aprobar imagen");
    }
  }

  async function rejectImage(imageId: number) {
    if (!confirm("¿Estás seguro de rechazar esta imagen?")) return;
    try {
      await apiFetch(`/cotizaciones/images/${imageId}/reject`, { method: "PUT" });
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, is_approved: false } : img))
      );
    } catch (err) {
      alert("Error al rechazar imagen");
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      setImageLoading(true);
      // We need to use raw fetch or adapt apiFetch for FormData if it doesn't support it automatically
      // Assuming apiFetch handles JSON, for FormData we might need to bypass or adjust content-type
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/cotizaciones/${selected.id}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data' // Do NOT set this manually, browser does it with boundary
        },
        body: formData,
      });
      
      if (!res.ok) throw new Error("Error subiendo imagen");
      
      await fetchImages(selected.id);
      alert("Imagen subida correctamente");
    } catch (err) {
      console.error(err);
      alert("Error al subir la imagen");
    } finally {
      setImageLoading(false);
      // Clear input
      e.target.value = "";
    }
  }

  async function openDetail(q: Quote) {
    setDetailLoading(true);
    try {
      const detail = await apiFetch<Quote>(`/cotizaciones/${q.id}/reporte`).catch(() =>
        apiFetch<Quote>(`/cotizaciones/${q.id}`),
      );
      const normalized: Quote = {
        ...detail,
        progressUpdates: detail.progressUpdates ?? (detail as any)?.timeline ?? [],
      };
      setSelected(normalized);
      fetchImages(normalized.id);
    } catch (err) {
      console.error(err);
      setSelected(q);
    } finally {
      setDetailLoading(false);
    }
  }

  const stats = useMemo(() => {
    if (apiStats) {
      return {
        PENDIENTE: apiStats.byStatus?.PENDIENTE ?? 0,
        PRODUCCION: apiStats.byStatus?.PRODUCCION ?? 0,
        INSTALACION: apiStats.byStatus?.INSTALACION ?? 0,
        FINALIZADA: apiStats.byStatus?.FINALIZADA ?? 0,
        TOTAL: apiStats.total ?? 0,
      };
    }
    // Fallback a cálculo en cliente si el API no lo provee
    return items.reduce(
      (acc, q) => {
        const s = (q.status || "PENDIENTE").toUpperCase();
        if (s === "PENDIENTE") acc.PENDIENTE++;
        if (s === "PRODUCCION") acc.PRODUCCION++;
        if (s === "INSTALACION") acc.INSTALACION++;
        if (s === "FINALIZADA") acc.FINALIZADA++;
        acc.TOTAL++;
        return acc;
      },
      { PENDIENTE: 0, PRODUCCION: 0, INSTALACION: 0, FINALIZADA: 0, TOTAL: 0 },
    );
  }, [items, apiStats]);

  const timeline = useMemo(() => {
    if (!selected) return [] as ProgressUpdate[];
    return (selected.timeline ?? selected.progressUpdates ?? []) as ProgressUpdate[];
  }, [selected]);

  const pendingUpdates = useMemo(() => {
    return timeline
      .map((update, index) => ({ update, index }))
      .filter(({ update }) => update.approvalStatus === "PENDING")
      .sort((a, b) => {
        const aTime = new Date(a.update.createdAt ?? 0).getTime();
        const bTime = new Date(b.update.createdAt ?? 0).getTime();
        return bTime - aTime;
      });
  }, [timeline]);

  const getPendingCount = (quote: Quote) => {
    const list = quote.timeline ?? quote.progressUpdates ?? [];
    return list.filter((u) => u.approvalStatus === "PENDING").length;
  };

  const exportToPDF = () => {
    if (!selected) return;
    
    import('jspdf').then(jsPDF => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF.default();
        const title = `Reporte de Cotización: ${selected.code || `#${selected.id}`}`;
        const clientInfo = `Cliente: ${selected.customerName} (${selected.customerEmail})`;
        const statusInfo = `Estado Actual: ${selected.status}`;
        
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.text(clientInfo, 14, 30);
        doc.text(statusInfo, 14, 36);

        const tableData = selected.timeline?.map(p => [
          formatDate(p.createdAt),
          p.author || 'Sistema',
          p.message,
          p.status || '',
        ]) || [];

        (doc as any).autoTable({
          startY: 45,
          head: [['Fecha', 'Autor', 'Descripción', 'Nuevo Estado']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [22, 160, 133] },
        });

        let finalY = (doc as any).lastAutoTable.finalY || 80;

        // Añadir lista de materiales si existen
        const allMaterials = selected.timeline?.flatMap(t => t.materialList || []) || [];
        if (allMaterials.length > 0) {
          doc.setFontSize(14);
          doc.text("Materiales Utilizados", 14, finalY + 10);
          const materialData = allMaterials.map(m => [m.name, m.quantity, m.unit, m.provider || 'N/A']);
          (doc as any).autoTable({
            startY: finalY + 15,
            head: [['Material', 'Cantidad', 'Unidad', 'Proveedor']],
            body: materialData,
          });
          finalY = (doc as any).lastAutoTable.finalY;
        }

        // Añadir firma si existe
        if (selected.technicianSignature) {
          doc.setFontSize(12);
          doc.text("Firma del Técnico:", 14, finalY + 15);
          doc.addImage(selected.technicianSignature, 'PNG', 14, finalY + 20, 100, 40);
        }

        doc.save(`reporte_${selected.code || selected.id}.pdf`);
      });
    });
  };

  return (
    <Protected>
      <div className="space-y-6">
        <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Operaciones</h1>
            <p className="sp-muted mt-1">
              Visualiza, actualiza estados, registra avances y abre el seguimiento del cliente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadQuotes} variant="secondary">
              Refrescar
            </Button>
            {selected && (
              <Button onClick={exportToPDF} variant="primary">
                Exportar PDF
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <h3 className="sp-muted font-medium">Cotizaciones Totales</h3>
            <p className="text-3xl font-bold">{loading ? "..." : stats.TOTAL}</p>
          </Card>
          <Card>
            <h3 className="sp-muted font-medium">Pendientes</h3>
            <p className="text-3xl font-bold">{loading ? "..." : stats.PENDIENTE}</p>
          </Card>
          <Card>
            <h3 className="sp-muted font-medium">En Producción</h3>
            <p className="text-3xl font-bold">{loading ? "..." : stats.PRODUCCION}</p>
          </Card>
          <Card>
            <h3 className="sp-muted font-medium">Instalación</h3>
            <p className="text-3xl font-bold">{loading ? "..." : stats.INSTALACION}</p>
          </Card>
          <Card>
            <h3 className="sp-muted font-medium">Finalizadas</h3>
            <p className="text-3xl font-bold">{loading ? "..." : stats.FINALIZADA}</p>
          </Card>
        </div>

        <Card>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="Buscar por código, cliente o..."
              className="sp-input md:w-1/3"
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
            />
            <select
              className="sp-select md:w-auto"
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
            >
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="sp-input"
              value={filters.from}
              onChange={(e) => updateFilters({ from: e.target.value })}
            />
            <input
              type="date"
              className="sp-input"
              value={filters.to}
              onChange={(e) => updateFilters({ to: e.target.value })}
            />
          </div>

          {loading && <p>Cargando...</p>}
          {error && <p className="text-red-500">{error}</p>}

          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>Código</Th>
                      <Th>Cliente</Th>
                      <Th>Estado</Th>
                      <Th className="hidden md:table-cell">Avance</Th>
                      <Th className="hidden lg:table-cell">Fechas</Th>
                      <Th className="hidden md:table-cell">Monto</Th>
                      <Th className="hidden xl:table-cell">Técnico</Th>
                      <Th className="hidden xl:table-cell">Última actualización</Th>
                      <Th>Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((q) => (
                      <tr key={q.id}>
                        <Td>
                          <div className="font-bold">{q.code || `COT-${q.id}`}</div>
                          <div className="text-xs sp-muted">#{q.orderId}</div>
                        </Td>
                        <Td>
                          <div className="font-medium">{q.customerName}</div>
                          <div className="text-xs sp-muted">{q.customerEmail}</div>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={statusColors(q.status).badge}>
                              {q.status}
                            </span>
                            {getPendingCount(q) > 0 && (
                              <span className="sp-badge sp-badge--accent">
                                {getPendingCount(q)} pendiente{getPendingCount(q) > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td className="hidden md:table-cell">
                          <div className="w-24">
                            <div className="h-2 bg-[var(--surface-2)] rounded-full">
                              <div
                                className="h-2 bg-[var(--brand-primary)] rounded-full"
                                style={{
                                  width: `${q.progressPercent ?? statusToPercent(q.status)}%`,
                                }}
                              ></div>
                            </div>
                            <div className="text-xs text-center mt-1">
                              {q.progressPercent ?? statusToPercent(q.status)}%
                            </div>
                          </div>
                        </Td>
                        <Td className="hidden lg:table-cell">
                          <div className="text-xs">
                            <span className="font-semibold">Creada:</span>{" "}
                            {formatDate(q.createdAt)}
                          </div>
                          <div className="text-xs">
                            <span className="font-semibold">Entrega:</span>{" "}
                            {formatDate(q.estimatedDeliveryDate)}
                          </div>
                        </Td>
                        <Td className="hidden md:table-cell">{formatMoney(q.totalAmount)}</Td>
                        <Td className="hidden xl:table-cell">
                          <div className="text-xs">{q.technicianName || 'No asignado'}</div>
                        </Td>
                        <Td className="hidden xl:table-cell">
                          <div className="text-xs max-w-[150px] truncate sp-muted">
                            {q.lastUpdateMessage || "Sin actualizaciones"}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button onClick={() => openDetail(q)} size="sm">
                              Ver detalle
                            </Button>
                            {profile?.role === "ADMIN" && (
                              <Button
                                onClick={() => openDeleteConfirm(q)}
                                size="sm"
                                variant="danger"
                              >
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <p className="text-sm sp-muted">
                  Mostrando {items.length} de {total} cotizaciones
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="p-2">
                    Página {page} de {Math.ceil(total / pageSize)}
                  </span>
                  <Button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= Math.ceil(total / pageSize)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {selected && (
          <Modal
            isOpen={!!selected}
            onClose={() => setSelected(null)}
            size="4xl"
            title={`Detalle de Cotización: ${selected.code || `#${selected.id}`}`}
          >
            {detailLoading ? (
              <p>Cargando detalles...</p>
            ) : (
              <div className="space-y-6">
                <div className="sp-card sp-card-static">
                  <div className="sp-card-body">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="text-sm sp-muted">Progreso global</div>
                        <div className="text-2xl font-bold">
                          {selected?.progressPercent ?? statusToPercent(selected?.status)}%
                        </div>
                        <div className="text-xs sp-muted mt-1">
                          Estado actual: {selected?.status}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 text-sm">
                        <div className="sp-panel">
                          <div className="text-xs sp-muted">Entrega estimada</div>
                          <div className="font-semibold">
                            {selected?.estimatedDeliveryDate ? formatDate(selected.estimatedDeliveryDate) : "—"}
                          </div>
                        </div>
                        <div className="sp-panel">
                          <div className="text-xs sp-muted">Técnico</div>
                          <div className="font-semibold">
                            {selected?.technicianName || "No asignado"}
                          </div>
                        </div>
                        <div className="sp-panel">
                          <div className="text-xs sp-muted">Pendientes</div>
                          <div className="font-semibold">{pendingUpdates.length}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="h-2 bg-[var(--surface-2)] rounded-full">
                        <div
                          className="h-2 bg-[var(--brand-primary)] rounded-full transition-all"
                          style={{
                            width: `${selected?.progressPercent ?? statusToPercent(selected?.status)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Reportes del Técnico */}
                  <Card>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">Reportes del técnico</h3>
                          <p className="text-sm sp-muted">
                            Se sincroniza desde la app móvil. Aquí apruebas o rechazas el siguiente avance.
                          </p>
                        </div>
                        {pendingUpdates.length > 0 && (
                          <span className="sp-badge sp-badge--primary">
                            {pendingUpdates.length} pendiente{pendingUpdates.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {pendingUpdates.length === 0 ? (
                        <div className="sp-panel text-sm sp-muted">
                          No hay reportes pendientes. El historial de cambios es el mismo que ve el cliente.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingUpdates.map(({ update, index }) => {
                            const attachments = update.attachmentUrls ?? [];
                            const imageAttachments = attachments.filter(isImageAttachment);
                            const fileAttachments = attachments.filter((url) => !isImageAttachment(url));
                            const signature = update.technicianSignature || selected?.technicianSignature;
                            return (
                              <div key={`${update.id ?? index}`} className="sp-panel space-y-4">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold">{update.message || "Reporte sin mensaje"}</span>
                                      {update.status && (
                                        <span className={statusColors(update.status).badge}>{update.status}</span>
                                      )}
                                    </div>
                                    <div className="text-xs sp-muted mt-1">
                                      {formatDate(update.createdAt)} · {update.author || update.technician || "Técnico"}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => approveUpdate(index)}>
                                      Aprobar
                                    </Button>
                                    <Button size="sm" variant="danger" onClick={() => rejectUpdate(index)}>
                                      Rechazar
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                  <div className="sp-card sp-card-static p-3">
                                    <div className="text-xs sp-muted">Progreso</div>
                                    <div className="text-base font-semibold">{update.progressPercent ?? "—"}%</div>
                                  </div>
                                  <div className="sp-card sp-card-static p-3">
                                    <div className="text-xs sp-muted">Entrega estimada</div>
                                    <div className="text-base font-semibold">
                                      {update.estimatedDate ? formatDate(update.estimatedDate) : "—"}
                                    </div>
                                  </div>
                                  <div className="sp-card sp-card-static p-3">
                                    <div className="text-xs sp-muted">Técnico</div>
                                    <div className="text-base font-semibold">
                                      {update.technician || selected?.technicianName || "Sin asignar"}
                                    </div>
                                  </div>
                                </div>

                                {update.materialList && update.materialList.length > 0 && (
                                  <div>
                                    <div className="text-sm font-semibold mb-2">Materiales reportados</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                      {update.materialList.map((mat, idx) => (
                                        <div key={idx} className="sp-panel">
                                          <div className="font-semibold">{mat.name}</div>
                                          <div className="sp-muted">
                                            {mat.quantity} {mat.unit} · {mat.provider || "Sin proveedor"}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {signature && (
                                  <div>
                                    <div className="text-sm font-semibold mb-2">Firma del técnico</div>
                                    <img
                                      src={signature}
                                      alt="Firma del técnico"
                                      className="h-24 w-auto rounded-xl border border-[var(--border)] bg-white"
                                    />
                                  </div>
                                )}

                                {attachments.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-sm font-semibold">Adjuntos</div>
                                    {imageAttachments.length > 0 && (
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {imageAttachments.map((url, i) => (
                                          <a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block"
                                          >
                                            <img
                                              src={url}
                                              alt={`Adjunto ${i + 1}`}
                                              className="h-24 w-full object-cover rounded-xl border border-[var(--border)]"
                                            />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                    {fileAttachments.length > 0 && (
                                      <div className="flex flex-wrap gap-2 text-xs">
                                        {fileAttachments.map((url, i) => (
                                          <a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="sp-badge sp-badge--primary"
                                          >
                                            Ver archivo {i + 1}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Historial de Cambios */}
                  <Card>
                    <h3 className="text-lg font-semibold mb-1">Historial de Cambios</h3>
                    <p className="text-xs sp-muted mb-3">Este historial es el mismo que ve el cliente.</p>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {timeline.map((p, index) => {
                        const attachments = p.attachmentUrls ?? [];
                        const imageAttachments = attachments.filter(isImageAttachment);
                        const fileAttachments = attachments.filter((url) => !isImageAttachment(url));
                        const signature = p.technicianSignature;
                        return (
                          <div key={index} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{p.message}</p>
                              {p.status && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors(p.status).badge}`}>
                                  {p.status}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sp-muted">
                              {formatDate(p.createdAt)} por {p.author || "Sistema"}
                            </p>

                            {p.materialList && p.materialList.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-semibold mb-1">Materiales</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {p.materialList.map((m, idx) => (
                                    <div key={idx} className="sp-panel">
                                      <div className="font-semibold">{m.name}</div>
                                      <div className="sp-muted">{m.quantity} {m.unit} · {m.provider || "Sin proveedor"}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {signature && (
                              <div className="mt-3">
                                <div className="text-xs font-semibold mb-1">Firma</div>
                                <img
                                  src={signature}
                                  alt="Firma del técnico"
                                  className="h-20 w-auto rounded-xl border border-[var(--border)] bg-white"
                                />
                              </div>
                            )}

                            {attachments.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <div className="text-xs font-semibold">Adjuntos</div>
                                {imageAttachments.length > 0 && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {imageAttachments.map((url, i) => (
                                      <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={url}
                                          alt={`Adjunto ${i + 1}`}
                                          className="h-20 w-full object-cover rounded-xl border border-[var(--border)]"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {fileAttachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {fileAttachments.map((url, i) => (
                                      <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="sp-badge sp-badge--primary"
                                      >
                                        Ver archivo {i + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-1 space-y-6">
                  {/* Detalles del Cliente */}
                  <Card>
                    <h3 className="text-lg font-semibold mb-3">Información</h3>
                     <Button 
                        size="sm" 
                        className="w-full mb-3"
                        onClick={() => {
                          loadWorkload();
                          setShowAssignModal(true);
                        }}
                      >
                        {selected.technicianName ? `Reasignar (Actual: ${selected.technicianName})` : 'Asignar Técnico'}
                      </Button>
                    <p><strong>Cliente:</strong> {selected.customerName}</p>
                    <p><strong>Email:</strong> {selected.customerEmail}</p>
                    <p><strong>Teléfono:</strong> {selected.customerPhone}</p>
                    <p><strong>Total:</strong> {formatMoney(selected.totalAmount)}</p>
                    <p><strong>Técnico:</strong> {selected.technicianName || 'No asignado'}</p>
                  </Card>

                  {/* Galería de Imágenes */}
                  <Card>
                    <h3 className="text-lg font-semibold mb-3">Galería de Avances</h3>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="sp-file mb-3"
                    />
                    {imageLoading && <p>Cargando imágenes...</p>}
                    <div className="grid grid-cols-2 gap-2">
                      {images.map((img) => (
                        <div key={img.id} className="relative group">
                          <img
                            src={img.image_url}
                            alt="avance"
                            className="w-full h-auto rounded-md"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs p-1 transition-opacity">
                            <p>Subido por: {img.user?.fullName || img.user?.email}</p>
                            <p>{formatDate(img.uploaded_at)}</p>
                            <div className="flex gap-1 mt-1">
                              <Button size="xs" variant={img.is_approved ? 'secondary' : 'success'} onClick={() => approveImage(Number(img.id))}>
                                {img.is_approved ? 'Aprobada' : 'Aprobar'}
                              </Button>
                              <Button size="xs" variant="danger" onClick={() => rejectImage(Number(img.id))}>Rechazar</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
              </div>
            )}
          </Modal>
        )}

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteQuote}
          title="Eliminar cotización"
          message={`¿Seguro que deseas eliminar la cotización ${deleteTarget?.code || `#${deleteTarget?.id}` }? Esta acción no se puede deshacer.`}
          type="danger"
          confirmText={deleting ? "Eliminando..." : "Eliminar"}
          cancelText="Cancelar"
        />
        
        <AssignmentModal 
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onAssign={handleAssign}
          technicians={technicians}
        />
      </div>
    </Protected>
  );
}
