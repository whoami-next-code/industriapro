import React from "react";

type TableProps = React.TableHTMLAttributes<HTMLTableElement> & { compact?: boolean };

export default function Table({ compact = false, className, ...props }: TableProps) {
  const base = "sp-table text-sm";
  const cls = className ? `${base} ${className}` : base;
  return <table {...props} className={cls} />;
}

export function Th({ children, className = "", ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th {...props} className={`text-left font-semibold ${className}`}>{children}</th>
  );
}

export function Td({ children, className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} className={`text-sm ${className}`}>{children}</td>
  );
}
