import React from "react";

export default function Stat({
  label,
  value,
  icon,
  tone = "primary",
  helper,
  helperIcon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "primary" | "secondary" | "accent";
  helper?: string;
  helperIcon?: React.ReactNode;
}) {
  const toneClass = {
    primary: "sp-widget-primary",
    secondary: "sp-widget-secondary",
    accent: "sp-widget-accent",
  }[tone];
  return (
    <div className={`sp-widget ${toneClass} flex items-center justify-between`}>
      <div>
        <div className="text-xs sp-muted">{label}</div>
        <div className="mt-1 text-2xl font-extrabold">{value}</div>
        {helper && (
          <div className="mt-2 flex items-center gap-1 text-[11px] sp-muted">
            {helperIcon}
            <span>{helper}</span>
          </div>
        )}
      </div>
      {icon && (<div className="text-[var(--text)]">{icon}</div>)}
    </div>
  );
}
