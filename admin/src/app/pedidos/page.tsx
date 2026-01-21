"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Protected from "@/lib/Protected";
import Card from "@/components/ui/Card";
import Table, { Th, Td } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Modal from "@/components/modals/Modal";

type Order = { 
  id: number; 
  status: string; 
  total: number; 
  createdAt: string;
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  customerName?: string;
  customerDni?: string;
  customerEmail?: string;
  customerPhone?: string;
  userId?: number;
  notes?: string;
  cliente?: { nombre: string; email?: string };
  items?: Array<{ producto?: { nombre: string }; cantidad: number; precio: number; name?: string; quantity?: number; price?: number }>;
};

type Avance = {
  fecha: string;
  mensaje: string;
  estado?: string;
  tecnico?: string;
};

type Evidencia = {
  fecha: string;
  archivos: string[];
  tipos: string[];
  comentarios: string[];
};

export default function AdminPedidos() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [comprobante, setComprobante] = useState<any | null>(null);
  const [factura, setFactura] = useState<any | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ method?: string; id?: string } | null>(null);

  const parseItems = (raw: Order['items'] | string | null | undefined) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const normalizeItems = (raw: ReturnType<typeof parseItems>) => {
    return raw.map((item: any) => ({
      nombre: item?.producto?.nombre || item?.name || item?.producto || 'N/A',
      cantidad: Number(item?.cantidad ?? item?.quantity ?? 0),
      precio: Number(item?.precio ?? item?.price ?? 0),
    }));
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { setLoading(false); return; }
    setError(null);
    apiFetch<Order[]>('/pedidos')
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error cargando pedidos'))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: number, status: string) {
    try {
      const updated = await apiFetch<{ status: string }>(`/pedidos/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      setItems(prev => prev.map(o => o.id === id ? { ...o, status: updated.status } : o));
      if (selected && selected.id === id) {
        setSelected({ ...selected, status: updated.status });
      }
    } catch {
      alert('No se pudo actualizar el estado');
    }
  }

  async function openDetail(order: Order) {
    setSelected(order);
    setDetailLoading(true);
    setAvances([]);
    setEvidencias([]);
    setComprobante(null);
    setFactura(null);
    setPaymentInfo(null);
    
    try {
      const detail = await apiFetch<Order>(`/pedidos/${order.id}`);
      const normalizedItems = normalizeItems(parseItems(detail.items));
      setSelected({ ...detail, items: normalizedItems as any });
      
      // Parsear avances y evidencias desde notes
      if (detail.notes) {
        try {
          const notes = JSON.parse(detail.notes);
          if (notes.avances && Array.isArray(notes.avances)) {
            setAvances(notes.avances);
          }
          if (notes.evidencias && Array.isArray(notes.evidencias)) {
            setEvidencias(notes.evidencias);
          }
          if (notes.comprobante) {
            setComprobante(notes.comprobante);
          }
          if (notes.factura) {
            setFactura(notes.factura);
          }
          if (notes.payment) {
            setPaymentInfo(notes.payment);
          }
        } catch (e) {
          console.warn('Error parsing notes:', e);
        }
      }
    } catch (err) {
      console.error('Error loading detail:', err);
      alert('Error al cargar el detalle del pedido');
    } finally {
      setDetailLoading(false);
    }
  }

  function formatDate(dateString: string) {
    try {
      return new Date(dateString).toLocaleString('es-PE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  function formatMoney(amount: number) {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  }

  return (
    <Protected>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Cliente</Th>
                  <Th>Estado</Th>
                  <Th>Total</Th>
                  <Th>Fecha</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><Td className="p-3" colSpan={6}>Cargando...</Td></tr>
                ) : error ? (
                  <tr><Td className="p-3 text-red-600" colSpan={6}>{error}</Td></tr>
                ) : items.length === 0 ? (
                  <tr><Td className="p-3" colSpan={6}>No hay pedidos</Td></tr>
                ) : items.map(o => (
                  <tr key={o.id}>
                    <Td>#{o.id}</Td>
                    <Td>{o.cliente?.nombre || o.customerName || 'N/A'}</Td>
                    <Td>
                      <span className={`sp-badge ${
                        o.status === 'COMPLETADO'
                          ? 'sp-badge--secondary'
                          : o.status === 'ENVIADO'
                            ? 'sp-badge--primary'
                            : 'sp-badge--accent'
                      }`}>
                        {o.status}
                      </span>
                    </Td>
                    <Td>{formatMoney(o.total)}</Td>
                    <Td>{formatDate(o.createdAt)}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="text-xs" onClick={() => openDetail(o)}>
                          Ver detalle
                        </Button>
                        {o.status !== 'ENVIADO' && (
                          <button 
                            onClick={() => updateStatus(o.id, 'ENVIADO')} 
                            className="text-xs text-blue-600 hover:text-blue-500"
                          >
                            Enviado
                          </button>
                        )}
                        {o.status !== 'COMPLETADO' && (
                          <button 
                            onClick={() => updateStatus(o.id, 'COMPLETADO')} 
                            className="text-xs text-emerald-600 hover:text-emerald-500"
                          >
                            Completar
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Modal 
          isOpen={!!selected} 
          onClose={() => setSelected(null)} 
          title={`Pedido #${selected?.id ?? ""}`} 
          size="xl"
        >
          {detailLoading || !selected ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <div className="space-y-6">
              {/* Información básica */}
              <Card title="Información del Pedido">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold sp-muted">Estado:</span>
                    <span className={`ml-2 sp-badge ${
                      selected.status === 'COMPLETADO'
                        ? 'sp-badge--secondary'
                        : selected.status === 'ENVIADO'
                          ? 'sp-badge--primary'
                          : 'sp-badge--accent'
                    }`}>
                      {selected.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold sp-muted">Total:</span>
                    <span className="ml-2">{formatMoney(selected.total)}</span>
                  </div>
                  <div>
                    <span className="font-semibold sp-muted">Fecha:</span>
                    <span className="ml-2">{formatDate(selected.createdAt)}</span>
                  </div>
                  {selected.cliente && (
                    <div>
                      <span className="font-semibold sp-muted">Cliente:</span>
                      <span className="ml-2">{selected.cliente.nombre}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Items del pedido */}
              {Array.isArray(selected.items) && selected.items.length > 0 && (
                <Card title="Productos">
                  <div className="overflow-x-auto">
                    <table className="sp-table text-sm">
                      <thead>
                        <tr>
                          <th className="text-left">Producto</th>
                          <th className="text-right">Cantidad</th>
                          <th className="text-right">Precio</th>
                          <th className="text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="text-sm">{item.producto?.nombre || (item as any).nombre || item.name || 'N/A'}</td>
                            <td className="text-right text-sm">{item.cantidad ?? (item as any).quantity ?? 0}</td>
                            <td className="text-right text-sm">{formatMoney(item.precio ?? (item as any).price ?? 0)}</td>
                            <td className="text-right text-sm">{formatMoney((item.cantidad ?? (item as any).quantity ?? 0) * (item.precio ?? (item as any).price ?? 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              <Card title="Detalles de la Venta">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold sp-muted">Método de pago:</span>
                    <span className="ml-2">{selected.paymentMethod || paymentInfo?.method || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold sp-muted">Estado de pago:</span>
                    <span className="ml-2">{selected.paymentStatus || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold sp-muted">Documento:</span>
                    <span className="ml-2">{selected.customerDni || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold sp-muted">Cliente:</span>
                    <span className="ml-2">{selected.customerName || selected.cliente?.nombre || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold sp-muted">Correo:</span>
                    <span className="ml-2">{selected.customerEmail || selected.cliente?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold sp-muted">Teléfono:</span>
                    <span className="ml-2">{selected.customerPhone || 'N/A'}</span>
                  </div>
                </div>
              </Card>

              {(comprobante || factura) && (
                <Card title="Comprobante / Factura">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {comprobante && (
                      <div className="rounded-lg border border-[var(--border)] p-4 space-y-1">
                        <div className="font-semibold">Comprobante</div>
                        <div className="sp-muted">ID: {comprobante.id}</div>
                        <div className="sp-muted">Tipo: {comprobante.type}</div>
                        <div className="sp-muted">Total: {formatMoney(comprobante.totals?.total ?? selected.total)}</div>
                        <div className="sp-muted">
                          Documento: {comprobante.customerInfo?.documentType} {comprobante.customerInfo?.document}
                        </div>
                      </div>
                    )}
                    {factura && (
                      <div className="rounded-lg border border-[var(--border)] p-4 space-y-1">
                        <div className="font-semibold">Factura</div>
                        <div className="sp-muted">ID: {factura.id}</div>
                        <div className="sp-muted">Tipo: {factura.type}</div>
                        <div className="sp-muted">Total: {formatMoney(factura.totals?.total ?? selected.total)}</div>
                        <div className="sp-muted">
                          Documento: {factura.customerInfo?.documentType} {factura.customerInfo?.document}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Avances desde la app Flutter */}
              <Card title="Avances de Producción">
                {avances.length > 0 ? (
                  <ul className="space-y-4">
                    {avances.map((avance, idx) => (
                      <li key={idx} className="flex gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold">{avance.mensaje || avance.message || 'Sin mensaje'}</span>
                            {avance.estado && (
                              <span className="sp-badge sp-badge--primary">
                                {avance.estado}
                              </span>
                            )}
                          </div>
                          <div className="text-xs sp-muted mt-1">
                            {formatDate(avance.fecha)}
                            {avance.tecnico && ` · Técnico: ${avance.tecnico}`}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sp-muted text-sm">Sin avances registrados desde la app móvil.</p>
                )}
              </Card>

              {/* Evidencias desde la app Flutter */}
              <Card title="Evidencias">
                {evidencias.length > 0 ? (
                  <div className="space-y-4">
                    {evidencias.map((evidencia, idx) => (
                      <div key={idx} className="border border-[var(--border)] rounded-xl p-4">
                        <div className="text-xs sp-muted mb-2">
                          {formatDate(evidencia.fecha)}
                        </div>
                        {evidencia.archivos && evidencia.archivos.length > 0 && (
                          <div className="mb-2">
                            <span className="text-sm font-semibold sp-muted">Archivos:</span>
                            <ul className="list-disc list-inside text-sm sp-muted ml-2">
                              {evidencia.archivos.map((archivo, aIdx) => (
                                <li key={aIdx}>{archivo}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {evidencia.tipos && evidencia.tipos.length > 0 && (
                          <div className="mb-2">
                            <span className="text-sm font-semibold sp-muted">Tipos:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {evidencia.tipos.map((tipo, tIdx) => (
                                <span key={tIdx} className="sp-badge sp-badge--primary">
                                  {tipo}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {evidencia.comentarios && evidencia.comentarios.length > 0 && (
                          <div>
                            <span className="text-sm font-semibold sp-muted">Comentarios:</span>
                            <ul className="list-disc list-inside text-sm sp-muted ml-2">
                              {evidencia.comentarios.filter(c => c && c.trim()).map((comentario, cIdx) => (
                                <li key={cIdx}>{comentario}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="sp-muted text-sm">Sin evidencias registradas desde la app móvil.</p>
                )}
              </Card>

              {/* Acciones */}
              <div className="flex gap-2 justify-end">
                {selected.status !== 'ENVIADO' && (
                  <Button onClick={() => {
                    updateStatus(selected.id, 'ENVIADO');
                  }}>
                    Marcar como Enviado
                  </Button>
                )}
                {selected.status !== 'COMPLETADO' && (
                  <Button variant="primary" onClick={() => {
                    updateStatus(selected.id, 'COMPLETADO');
                  }}>
                    Marcar como Completado
                  </Button>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Protected>
  );
}

