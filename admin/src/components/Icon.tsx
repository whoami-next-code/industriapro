"use client";
import React from "react";
import {
  ChartBarIcon,
  CubeIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  UserIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

export type IconName = "dashboard" | "productos" | "cotizaciones" | "pedidos" | "usuarios" | "generic";
type Variant = "svg" | "fa" | "flaticon" | "hero";

// Wrapper ligero de iconos con soporte para:
// - SVG local (por defecto)
// - Font Awesome clásico (clase "fa") ya importado en el proyecto
// - Flaticon (clase "flaticon-*") si está disponible
export default function Icon({
  name = "generic",
  size = 18,
  className = "",
  variant = "svg",
}: {
  name?: IconName;
  size?: number;
  className?: string;
  variant?: Variant;
}) {
  if (variant === "flaticon") {
    const cls = `flaticon-${name}`;
    return <i className={`${cls} ${className}`} aria-hidden="true" style={{ fontSize: size }} />;
  }

  const heroMap: Record<IconName, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    dashboard: ChartBarIcon,
    productos: CubeIcon,
    cotizaciones: DocumentTextIcon,
    pedidos: ShoppingCartIcon,
    usuarios: UserIcon,
    generic: Squares2X2Icon,
  };
  const HeroIcon = heroMap[name] ?? heroMap.generic;
  return <HeroIcon className={className} aria-hidden="true" style={{ width: size, height: size }} />;
}
