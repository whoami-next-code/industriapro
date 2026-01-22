import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base = "sp-button focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "sp-button-primary",
    secondary: "sp-button-outline",
    danger: "bg-rose-500 hover:bg-rose-400 text-white border border-transparent",
    ghost: "sp-button-ghost",
  };
  const sizes: Record<string, string> = {
    sm: "text-sm py-1 px-3 h-8",
    md: "text-sm py-2 px-4",
    lg: "text-base py-3 px-5",
  };
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  return (
    <button {...props} className={cls}>{children}</button>
  );
}
