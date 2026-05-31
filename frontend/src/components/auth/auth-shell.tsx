import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
      <div className="grid w-full gap-8 md:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between rounded-[2rem] bg-[#0f1720] p-8 text-white shadow-panel md:p-10">
          <div className="space-y-6">
            <Link
              href="/"
              className="inline-flex w-fit rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Kanban
            </Link>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">
                {title}
              </h1>
              <p className="max-w-lg text-base leading-7 text-white/70">
                {description}
              </p>
            </div>
          </div>
          <div className="mt-10 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            Magic Link, email/password auth and dashboard shell are already wired to the backend API.
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-8 shadow-panel backdrop-blur md:p-10">
          {children}
          {footer ? <div className="mt-6 text-sm text-[var(--muted)]">{footer}</div> : null}
        </section>
      </div>
    </main>
  );
}
