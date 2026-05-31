"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  leftIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-[0_14px_30px_rgba(255,107,53,0.28)] hover:bg-[var(--accent-dark)]",
  secondary:
    "bg-white/80 text-[var(--foreground)] border border-[var(--border)] hover:bg-white",
  ghost:
    "bg-transparent text-[var(--foreground)] hover:bg-black/5",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700",
};

export function Button({
  children,
  className = "",
  disabled,
  leftIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  );
}
