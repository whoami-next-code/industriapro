import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' };

export default function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base = "sp-button focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "sp-button-primary",
    secondary: "sp-button-outline",
    danger: "bg-rose-500 hover:bg-rose-400 text-white border border-transparent",
    ghost: "sp-button-ghost",
  };
  const cls = `${base} ${variants[variant]} ${className}`;
  return (
    <button {...props} className={cls}>{children}</button>
  );
}
