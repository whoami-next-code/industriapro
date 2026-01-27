'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Protected from '@/lib/Protected';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import { useAppStore } from '@/store/useAppStore';
import toast from 'react-hot-toast';
import {
  ShoppingCartIcon,
  CubeIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

type Profile = { email: string; role: string; nombre?: string };
type Stats = { 
  productos: number; 
  cotizaciones: number; 
  pedidos: number;
  usuarios: number;
  clientes: number;
  contactos: number;
  productosActivos: number;
  pedidosPendientes: number;
  cotizacionesAbiertas: number;
};

type Producto = {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  categoria: { nombre: string };
};

type Pedido = {
  id: number;
  total: number;
  estado: string;
  fechaCreacion: string;
  cliente?: { nombre: string };
  paymentStatus?: string;
  items?: Array<{
    productId?: number;
    name?: string;
    quantity?: number;
  }>;
};

type Cotizacion = {
  id: number;
  estado: string;
  total: number;
  fechaCreacion: string;
};

type Contacto = {
  id: number;
  mensaje: string;
  creadoEn?: string;
  createdAt?: string;
  respondidoEn?: string;
  respondidoPor?: string;
  estado?: string;
};

export default function AdminDashboard() {
  const [me, setMe] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useAppStore();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const profile = await apiFetch<Profile>('/auth/profile').catch(() => null);
      const isAdmin = profile?.role === 'ADMIN';
      const isVendedor = profile?.role === 'VENDEDOR';

      const productosPromise = apiFetch<Producto[]>('/productos').catch(() => []);
      const cotizacionesPromise = (isAdmin || isVendedor)
        ? apiFetch<Cotizacion[]>('/cotizaciones').catch(() => [])
        : Promise.resolve<Cotizacion[]>([]);
      const pedidosPromise = apiFetch<Pedido[]>('/pedidos').catch(() => []);
      const contactosPromise = apiFetch<any[]>('/contactos').catch(() => []);
      const usersPromise = isAdmin ? apiFetch<any[]>('/users').catch(() => []) : Promise.resolve<any[]>([]);
      const clientesPromise = isAdmin
        ? apiFetch<any[]>('/users?role=CLIENTE&verified=1').catch(() => [])
        : Promise.resolve<any[]>([]);

      const [prods, cots, peds, contactos, users, clientes] = await Promise.all([
        productosPromise,
        cotizacionesPromise,
        pedidosPromise,
        contactosPromise,
        usersPromise,
        clientesPromise,
      ]);

      setMe(profile);
      setProductos(Array.isArray(prods) ? prods : []);
      setCotizaciones(Array.isArray(cots) ? cots.map(normalizeCotizacion) : []);
      setPedidos(Array.isArray(peds) ? peds.map(normalizePedido) : []);
      setContactos(Array.isArray(contactos) ? contactos : []);

      const productosActivos = Array.isArray(prods) ? prods.filter((p: Producto) => p.stock > 0).length : 0;
      const pedidosPendientes = Array.isArray(peds)
        ? peds.filter((p: Pedido) => {
            const estado = String((p as any)?.estado ?? (p as any)?.orderStatus ?? (p as any)?.status ?? '').toUpperCase();
            const payment = String((p as any)?.paymentStatus ?? '').toUpperCase();
            return !['COMPLETADO', 'DELIVERED'].includes(estado) && payment !== 'COMPLETED';
          }).length
        : 0;
      const cotizacionesAbiertas = Array.isArray(cots) ? cots.filter((c: Cotizacion) => c.estado !== 'CERRADA').length : 0;

      setStats({
        productos: Array.isArray(prods) ? prods.length : 0,
        cotizaciones: Array.isArray(cots) ? cots.length : 0,
        pedidos: Array.isArray(peds) ? peds.length : 0,
        usuarios: Array.isArray(users) ? users.length : 0,
        clientes: Array.isArray(clientes) ? clientes.length : 0,
        contactos: Array.isArray(contactos) ? contactos.length : 0,
        productosActivos,
        pedidosPendientes,
        cotizacionesAbiertas,
      });

      addNotification({
        type: 'success',
        title: 'Dashboard actualizado',
        message: 'Los datos se han cargado correctamente',
      });
    } catch (error) {
      toast.error('Error al cargar los datos del dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getLast6MonthsData = () => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonth = new Date().getMonth();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      last6Months.push(months[monthIndex]);
    }
    
    return last6Months;
  };

  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(String(v ?? 0));
    return Number.isFinite(n) ? n : 0;
  };

  const normalizeOrderItems = (raw: any) => {
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

  const normalizePedido = (p: any): Pedido => ({
    id: Number(p?.id ?? 0),
    total: num(p?.total),
    estado: String(p?.estado ?? p?.orderStatus ?? p?.status ?? 'PENDIENTE'),
    fechaCreacion: String(p?.fechaCreacion ?? p?.createdAt ?? new Date().toISOString()),
    cliente: p?.cliente ?? (p?.customerName ? { nombre: p.customerName } : undefined),
    paymentStatus: String(p?.paymentStatus ?? ''),
    items: normalizeOrderItems(p?.items),
  });

  const normalizeCotizacion = (c: any): Cotizacion => ({
    id: Number(c?.id ?? 0),
    estado: String(c?.estado ?? c?.status ?? 'PENDIENTE'),
    total: num(c?.total ?? 0),
    fechaCreacion: String(c?.fechaCreacion ?? c?.createdAt ?? new Date().toISOString()),
  });

  const getPedidosPorMes = () => {
    const months = getLast6MonthsData();
    const currentDate = new Date();
    const data = months.map((_, index) => {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1);
      return pedidos.filter(p => {
        const pedidoDate = new Date(p.fechaCreacion);
        return pedidoDate.getMonth() === monthDate.getMonth() && 
               pedidoDate.getFullYear() === monthDate.getFullYear();
      }).length;
    });
    
    return [{ name: 'Pedidos', data }];
  };

  const getVentasPorMes = () => {
    const months = getLast6MonthsData();
    const currentDate = new Date();
    const data = months.map((_, index) => {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1);
      const totalVentas = pedidos
        .filter(p => {
          const pedidoDate = new Date(p.fechaCreacion);
          const estado = String(p.estado ?? '').toUpperCase();
          const payment = String(p.paymentStatus ?? '').toUpperCase();
          const isPaid = payment === 'COMPLETED' || estado === 'PAGADO' || estado === 'COMPLETADO';
          return pedidoDate.getMonth() === monthDate.getMonth() &&
                 pedidoDate.getFullYear() === monthDate.getFullYear() &&
                 isPaid;
        })
        .reduce((sum, p) => sum + num(p.total), 0);
      
      return Math.round(totalVentas);
    });
    
    return [{ name: 'Ventas (S/)', data }];
  };

  const getEstadosPedidos = () => {
    const estados = pedidos.reduce((acc: any, p) => {
      const key = String(p.estado ?? '').toUpperCase() || 'PENDIENTE';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const statusLabel = (status: string) => {
      switch (status) {
        case 'PENDING':
        case 'PENDIENTE':
          return 'Pendiente';
        case 'CONFIRMED':
          return 'Confirmado';
        case 'PROCESSING':
          return 'En proceso';
        case 'SHIPPED':
        case 'ENVIADO':
          return 'Enviado';
        case 'DELIVERED':
        case 'COMPLETADO':
          return 'Completado';
        case 'CANCELLED':
        case 'CANCELADO':
          return 'Cancelado';
        case 'PAGADO':
          return 'Pagado';
        default:
          return status;
      }
    };
    
    return {
      labels: Object.keys(estados).map(statusLabel),
      series: Object.values(estados) as number[],
    };
  };

  const getProductosMasVendidos = () => {
    const salesMap = new Map<string, number>();
    pedidos.forEach((pedido) => {
      (pedido.items ?? []).forEach((it: any) => {
        const name = String(it?.name ?? it?.nombre ?? it?.producto ?? '').trim();
        const key = name || (it?.productId ? `#${it.productId}` : 'Producto');
        const qty = Number(it?.quantity ?? it?.cantidad ?? it?.qty ?? 0);
        salesMap.set(key, (salesMap.get(key) || 0) + (Number.isFinite(qty) ? qty : 0));
      });
    });

    const sorted = [...salesMap.entries()]
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const categories = sorted.length
      ? sorted.map(([name]) => (name.length > 15 ? `${name.slice(0, 15)}...` : name))
      : ['Sin ventas'];
    const data = sorted.length ? sorted.map(([, qty]) => qty) : [0];

    return {
      categories,
      data: [{ name: 'Unidades vendidas', data }],
    };
  };

  const getUltimosPedidos = () => {
    return [...pedidos]
      .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
      .slice(0, 5);
  };

  const getWeeklyContactInsights = () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekly = contactos.filter((c) => {
      const raw = c.creadoEn || c.createdAt;
      const d = raw ? new Date(raw) : null;
      return d instanceof Date && !isNaN(d.getTime()) && d >= weekAgo;
    });

    const textFor = (c: Contacto) => `${c.mensaje ?? ""}`.toLowerCase();
    const categoryMap: Record<string, string[]> = {
      reclamos: ["reclamo", "queja", "malo", "defecto", "problema", "falla", "no funciona"],
      soporte: ["soporte", "ayuda", "asistencia", "error", "urgente", "parado"],
      instalacion: ["instalación", "instalacion", "instalar", "montaje"],
      mantenimiento: ["mantenimiento", "revisión", "revision", "calibrar", "limpieza"],
      cotizacion: ["cotización", "cotizacion", "precio", "presupuesto"],
      pagos: ["pago", "factura", "boleta", "ruc", "dni"],
      envios: ["envío", "envio", "delivery", "entrega"],
      garantia: ["garantía", "garantia", "devolución", "devolucion"],
    };

    const categorize = (msg: string) => {
      for (const [category, words] of Object.entries(categoryMap)) {
        if (words.some((w) => msg.includes(w))) return category;
      }
      return "otros";
    };

    const counts = weekly.reduce<Record<string, number>>((acc, c) => {
      const category = categorize(textFor(c));
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const total = weekly.length || 1;
    const topCategories = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category,
        count,
        percent: Math.round((count / total) * 100),
      }));

    const responseTimes = weekly
      .map((c) => {
        const created = c.creadoEn || c.createdAt;
        if (!created || !c.respondidoEn) return null;
        const start = new Date(created).getTime();
        const end = new Date(c.respondidoEn).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
        return (end - start) / (1000 * 60 * 60); // hours
      })
      .filter((n): n is number => n !== null);

    const avgHours = responseTimes.length
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    const within24 = responseTimes.filter((h) => h <= 24).length;
    const slaPercent = responseTimes.length
      ? Math.round((within24 / responseTimes.length) * 100)
      : 0;

    const top = topCategories[0];
    const suggestions: string[] = [];
    if (top && top.percent >= 30) {
      const label = top.category.replace("_", " ");
      suggestions.push(`Hay ${top.percent}% de contactos por ${label}. Considera reforzar procesos o guías internas.`);
    }
    if (slaPercent > 0 && slaPercent < 70) {
      suggestions.push("El SLA de respuesta en 24h está bajo. Prioriza la bandeja de contactos urgentes.");
    }
    if (weekly.length === 0) {
      suggestions.push("No hay suficientes contactos esta semana para generar tendencias.");
    }

    return {
      totalWeekly: weekly.length,
      avgHours,
      slaPercent,
      topCategories,
      suggestions,
    };
  };

  const getContactTrends = () => {
    const now = new Date();
    const days: string[] = [];
    const dayKeys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      days.push(d.toLocaleDateString('es-PE', { weekday: 'short' }));
    }

    const normalizeMsg = (c: Contacto) => `${c.mensaje ?? ""}`.toLowerCase();
    const categoryMap: Record<string, string[]> = {
      reclamos: ["reclamo", "queja", "malo", "defecto", "problema", "falla", "no funciona"],
      soporte: ["soporte", "ayuda", "asistencia", "error", "urgente", "parado"],
      instalacion: ["instalación", "instalacion", "instalar", "montaje"],
      mantenimiento: ["mantenimiento", "revisión", "revision", "calibrar", "limpieza"],
      cotizacion: ["cotización", "cotizacion", "precio", "presupuesto"],
      pagos: ["pago", "factura", "boleta", "ruc", "dni"],
      envios: ["envío", "envio", "delivery", "entrega"],
      garantia: ["garantía", "garantia", "devolución", "devolucion"],
    };

    const categorize = (msg: string) => {
      for (const [category, words] of Object.entries(categoryMap)) {
        if (words.some((w) => msg.includes(w))) return category;
      }
      return "otros";
    };

    const weekly = contactos.filter((c) => {
      const raw = c.creadoEn || c.createdAt;
      if (!raw) return false;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      const key = d.toISOString().slice(0, 10);
      return dayKeys.includes(key);
    });

    const countsByCategory: Record<string, number[]> = {};
    weekly.forEach((c) => {
      const raw = c.creadoEn || c.createdAt;
      if (!raw) return;
      const d = new Date(raw);
      const key = d.toISOString().slice(0, 10);
      const idx = dayKeys.indexOf(key);
      if (idx === -1) return;
      const cat = categorize(normalizeMsg(c));
      if (!countsByCategory[cat]) {
        countsByCategory[cat] = Array(dayKeys.length).fill(0);
      }
      countsByCategory[cat][idx] += 1;
    });

    const totals = Object.entries(countsByCategory)
      .map(([cat, arr]) => ({ cat, total: arr.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    const series = totals.map((t) => ({
      name: t.cat.replace("_", " "),
      data: countsByCategory[t.cat] || Array(dayKeys.length).fill(0),
    }));

    return { categories: days, series };
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="sp-card sp-card-static px-10 py-8 text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-[var(--brand-primary)] mx-auto mb-4"></div>
            <p className="sp-muted">Cargando dashboard...</p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="sp-muted mt-1">
              Bienvenido, {me?.nombre || me?.email || 'Administrador'}
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            className="sp-button sp-button-primary"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Stat
            label="Productos"
            value={stats?.productos ?? 0}
            icon={<CubeIcon className="h-6 w-6" />}
            tone="primary"
            helper={`${stats?.productosActivos ?? 0} activos`}
            helperIcon={<ArrowTrendingUpIcon className="h-3 w-3" />}
          />
          <Stat
            label="Pedidos"
            value={stats?.pedidos ?? 0}
            icon={<ShoppingCartIcon className="h-6 w-6" />}
            tone="secondary"
            helper={`${stats?.pedidosPendientes ?? 0} pendientes`}
            helperIcon={<ClockIcon className="h-3 w-3" />}
          />
          <Stat
            label="Cotizaciones"
            value={stats?.cotizaciones ?? 0}
            icon={<DocumentTextIcon className="h-6 w-6" />}
            tone="accent"
            helper={`${stats?.cotizacionesAbiertas ?? 0} abiertas`}
            helperIcon={<DocumentTextIcon className="h-3 w-3" />}
          />
          <Stat
            label="Clientes"
            value={stats?.clientes ?? 0}
            icon={<UserGroupIcon className="h-6 w-6" />}
            tone="primary"
            helper="Total registrados"
            helperIcon={<UserGroupIcon className="h-3 w-3" />}
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LineChart
            title="Tendencia de Pedidos (Últimos 6 meses)"
            data={getPedidosPorMes()}
            categories={getLast6MonthsData()}
            colors={['#7ba7ff']}
          />
          
          <BarChart
            title="Ventas Mensuales (S/)"
            data={getVentasPorMes()}
            categories={getLast6MonthsData()}
            colors={['#7fd1c8']}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DonutChart
            title="Estado de Pedidos"
            labels={getEstadosPedidos().labels}
            series={getEstadosPedidos().series}
          />
          
          <BarChart
            title="Top 5 Productos más vendidos"
            data={getProductosMasVendidos().data}
            categories={getProductosMasVendidos().categories}
            horizontal={true}
            colors={['#c9b8ff']}
          />
        </div>

        {/* Insights IA - Contactos */}
        <Card title="Insights IA (últimos 7 días)">
          {(() => {
            const insights = getWeeklyContactInsights();
            const avgLabel = insights.avgHours >= 24
              ? `${Math.round(insights.avgHours / 24)} días`
              : `${Math.round(insights.avgHours)} h`;
            const trends = getContactTrends();
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="sp-panel">
                    <div className="text-xs sp-muted">Contactos semanales</div>
                    <div className="text-2xl font-semibold">{insights.totalWeekly}</div>
                  </div>
                  <div className="sp-panel">
                    <div className="text-xs sp-muted">Tiempo promedio de respuesta</div>
                    <div className="text-2xl font-semibold">{avgLabel}</div>
                  </div>
                  <div className="sp-panel">
                    <div className="text-xs sp-muted">SLA &lt; 24h</div>
                    <div className="text-2xl font-semibold">{insights.slaPercent}%</div>
                  </div>
                </div>

                <div className="sp-card sp-card-static">
                  <div className="sp-card-body">
                    <BarChart
                      title="Picos por categoría (últimos 7 días)"
                      data={trends.series}
                      categories={trends.categories}
                      colors={['#7ba7ff', '#7fd1c8', '#c9b8ff', '#f7c58e']}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="sp-card sp-card-static">
                    <div className="sp-card-body">
                      <div className="text-sm font-semibold mb-2">Motivos principales</div>
                      {insights.topCategories.length === 0 ? (
                        <div className="text-sm sp-muted">Sin datos suficientes.</div>
                      ) : (
                        <div className="space-y-2">
                          {insights.topCategories.map((c) => (
                            <div key={c.category} className="flex items-center justify-between text-sm">
                              <span className="capitalize">{c.category.replace("_", " ")}</span>
                              <span className="sp-badge sp-badge--primary">{c.percent}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sp-card sp-card-static">
                    <div className="sp-card-body">
                      <div className="text-sm font-semibold mb-2">Sugerencias de mejora</div>
                      {insights.suggestions.length === 0 ? (
                        <div className="text-sm sp-muted">Sin sugerencias generadas.</div>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {insights.suggestions.map((s, idx) => (
                            <li key={idx} className="sp-panel">{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Últimos pedidos */}
        <Card title="Últimos Pedidos">
          <div className="overflow-x-auto">
            <table className="sp-table">
              <thead>
                <tr>
                  <th className="text-left">ID</th>
                  <th className="text-left">Cliente</th>
                  <th className="text-left">Total</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {getUltimosPedidos().map((pedido) => (
                  <tr key={pedido.id}>
                    <td className="text-sm font-medium">#{pedido.id}</td>
                    <td className="text-sm">
                      {pedido.cliente?.nombre || 'N/A'}
                    </td>
                    <td className="text-sm">
                      S/ {num(pedido.total).toFixed(2)}
                    </td>
                    <td className="text-sm">
                      <span className={`sp-badge ${
                        pedido.estado === 'COMPLETADO'
                          ? 'sp-badge--secondary'
                          : pedido.estado === 'ENVIADO'
                            ? 'sp-badge--primary'
                            : 'sp-badge--accent'
                      }`}>
                        {pedido.estado}
                      </span>
                    </td>
                    <td className="text-sm sp-muted">
                      {new Date(pedido.fechaCreacion).toLocaleDateString('es-PE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Perfil */}
        {me && (
          <Card title="Información del Usuario">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[rgba(123,167,255,0.2)] rounded-2xl flex items-center justify-center">
                  <EnvelopeIcon className="h-5 w-5 text-slate-900" />
                </div>
                <div>
                  <p className="text-xs sp-muted">Email</p>
                  <p className="text-sm font-medium">{me.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[rgba(201,184,255,0.25)] rounded-2xl flex items-center justify-center">
                  <ShieldCheckIcon className="h-5 w-5 text-slate-900" />
                </div>
                <div>
                  <p className="text-xs sp-muted">Rol</p>
                  <p className="text-sm font-medium">{me.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[rgba(127,209,200,0.25)] rounded-2xl flex items-center justify-center">
                  <CheckCircleIcon className="h-5 w-5 text-slate-900" />
                </div>
                <div>
                  <p className="text-xs sp-muted">Estado</p>
                  <p className="text-sm font-medium text-emerald-600">Autenticado</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Protected>
  );
}
