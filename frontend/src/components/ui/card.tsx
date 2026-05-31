import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-panel backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
