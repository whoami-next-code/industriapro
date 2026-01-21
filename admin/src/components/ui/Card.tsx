import React from "react";

export default function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`sp-card ${className}`}>
      {(title || actions) && (
        <header className="sp-card-header flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold tracking-wide">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="sp-card-body">
        {children}
      </div>
    </section>
  );
}
