"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAdminSocket } from "@/lib/AdminSocketProvider";
import { useAppStore } from "@/store/useAppStore";
import {
  SunIcon,
  MoonIcon,
  Bars3Icon,
  ChartBarIcon,
  UsersIcon,
  UserGroupIcon,
  CubeIcon,
  TagIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  EnvelopeIcon,
  ChartPieIcon,
} from "@heroicons/react/24/outline";

// Evitar hidratación inconsistente en HeadlessUI cuando se renderiza en SSR
const NotificationDropdown = dynamic(
  () => import("./notifications/NotificationDropdown"),
  { ssr: false },
);

type NavItem = { href: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "General",
    items: [
      { href: "/", label: "Dashboard", icon: ChartBarIcon },
      { href: "/reportes", label: "Reportes", icon: ChartPieIcon },
    ],
  },
  {
    title: "Gestión",
    items: [
      { href: "/usuarios", label: "Usuarios", icon: UsersIcon },
      { href: "/clientes", label: "Clientes", icon: UserGroupIcon },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/productos", label: "Productos", icon: CubeIcon },
      { href: "/categorias", label: "Categorías", icon: TagIcon },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/cotizaciones", label: "Cotizaciones", icon: DocumentTextIcon },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingCartIcon },
    ],
  },
  {
    title: "Atención",
    items: [
      { href: "/contactos", label: "Contactos", icon: EnvelopeIcon },
      { href: "/reporte-tecnico", label: "Reporte técnico", icon: DocumentTextIcon },
    ],
  },
];

export default function ModernAdminShell({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const pathname = usePathname();
  const { darkMode, sidebarCollapsed, toggleDarkMode, toggleSidebar } = useAppStore();

  useEffect(() => {
    const onResize = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile && !sidebarCollapsed) toggleSidebar();
  }, [isMobile]);

  useEffect(() => {
    const checkToken = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      setLoggedIn(Boolean(token));
    };
    checkToken();
    window.addEventListener('storage', checkToken);
    return () => window.removeEventListener('storage', checkToken);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDarkMode = localStorage.getItem('darkMode') === 'true';
      if (savedDarkMode !== darkMode) toggleDarkMode();
    }
  }, []);

  const sidebarCollapsedState = sidebarCollapsed;
  const sidebarWidth = sidebarCollapsedState ? "w-20" : "w-64";
  const sidebarPosition = isMobile
    ? `fixed inset-y-0 left-0 z-40 ${sidebarCollapsedState ? "-translate-x-full" : "translate-x-0"}`
    : "relative";

  return (
    <div className="sp-admin min-h-screen flex">
      {isMobile && !sidebarCollapsedState && (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-black/30"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sp-sidebar ${sidebarWidth} ${sidebarPosition} shrink-0 transition-all duration-200 ease-in-out`}
        aria-label="Menú lateral"
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-[var(--border)]">
          <button
            aria-label={!sidebarCollapsedState ? "Contraer menú" : "Expandir menú"}
            aria-expanded={!sidebarCollapsedState}
            onClick={toggleSidebar}
            className="sp-button sp-button-ghost h-10 w-10 !p-0"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
          <span
            className={`text-sm font-semibold tracking-wide ${
              !sidebarCollapsedState ? "opacity-100" : "opacity-0 pointer-events-none"
            } transition-opacity`}
          >
            Industrias SP
          </span>
        </div>

        <nav className="py-4" role="navigation" aria-label="Navegación principal">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className={`sp-nav-section ${sidebarCollapsedState ? "sr-only" : ""}`}>{group.title}</div>
              <ul className="space-y-1 px-3">
                {group.items.map((item) => {
                  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="sp-nav-link"
                        data-active={isActive}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className={`${!sidebarCollapsedState ? "block" : "sr-only"}`}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sp-topbar h-16 flex items-center justify-between px-4 lg:px-6" role="banner">
          <div className="flex items-center gap-4">
            {/* Mobile toggle */}
            <button
              aria-label={!sidebarCollapsedState ? "Contraer menú" : "Expandir menú"}
              aria-expanded={!sidebarCollapsedState}
              onClick={toggleSidebar}
              className="lg:hidden sp-button sp-button-ghost h-10 w-10 !p-0"
            >
              <Bars3Icon className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm sp-muted">Panel de administración</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionIndicator />
            <NotificationDropdown />
            <button
              onClick={toggleDarkMode}
              className="sp-button sp-button-ghost h-10 w-10 !p-0"
              aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
            </button>
            {loggedIn ? (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    window.dispatchEvent(new Event('auth-token-changed'));
                    window.location.href = '/auth/login';
                  }
                }}
                className="text-sm sp-muted hover:text-[var(--text)] transition"
                aria-label="Cerrar sesión"
              >
                Salir
              </button>
            ) : (
              <Link href="/auth/login" className="text-sm sp-muted hover:text-[var(--text)] transition">Login</Link>
            )}
          </div>
        </header>

        <main id="main" role="main" className="flex-1 min-w-0 p-4 lg:p-6">
          <div className="sp-main">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function ConnectionIndicator() {
  const { status, socket } = useAdminSocket();
  const effectiveStatus = socket?.connected ? "connected" : status;
  const color = effectiveStatus === "connected"
    ? "bg-emerald-400"
    : effectiveStatus === "connecting"
      ? "bg-amber-300"
      : effectiveStatus === "error"
        ? "bg-rose-400"
        : "bg-slate-300";
  const text = effectiveStatus === "connected"
    ? "Conectado"
    : effectiveStatus === "connecting"
      ? "Conectando"
      : effectiveStatus === "error"
        ? "Error"
        : "Desconectado";
  return <div className={`px-3 py-1 rounded-full text-[11px] font-semibold text-slate-900 ${color}`}>{text}</div>;
}
