"use client";
import Link from "next/link";
import Icon, { IconName } from "@/components/Icon";

type StatCardProps = {
  title: string;
  value: number | string;
  icon?: IconName;
  href?: string;
  accent?: "primary" | "info" | "success" | "warning";
};

export default function StatCard({ title, value, icon, href, accent = "info" }: StatCardProps) {
  const accentClass = {
    primary: "sp-badge--primary",
    info: "sp-badge--primary",
    success: "sp-badge--secondary",
    warning: "sp-badge--accent",
  }[accent];
  const content = (
    <div className="sp-card" aria-label={`${title}: ${value}`}>
      <div className="sp-card-body flex items-center gap-3">
        {icon && (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <Icon variant="hero" name={icon} size={18} className="text-[var(--text)]" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="sp-muted text-sm">{title}</div>
          <div className="text-2xl font-bold" aria-live="polite">{value}</div>
        </div>
        <span className={`sp-badge ${accentClass}`}>{title}</span>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} prefetch className="block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        {content}
      </Link>
    );
  }
  return content;
}
