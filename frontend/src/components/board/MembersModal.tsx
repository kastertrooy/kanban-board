"use client";

import { FormEvent, useMemo, useState } from "react";

import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardMember } from "@/store/boardStore";

type InviteRole = "EDITOR" | "VIEWER";

type InviteResponse = {
  token: string;
  role: InviteRole;
  inviteUrl?: string;
};

const INVITE_ROLES: InviteRole[] = ["EDITOR", "VIEWER"];

export function MembersModal({
  boardId,
  isOpen,
  onClose,
  members,
}: {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  members: BoardMember[];
}) {
  const [role, setRole] = useState<InviteRole>("EDITOR");
  const [inviteLink, setInviteLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const frontendUrl = useMemo(() => {
    if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
      return process.env.NEXT_PUBLIC_FRONTEND_URL.replace(/\/$/, "");
    }

    if (typeof window !== "undefined") {
      return window.location.origin;
    }

    return "";
  }, []);

  if (!isOpen) return null;

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsGenerating(true);

    try {
      const response = await api.post<InviteResponse>(`/boards/${boardId}/invites`, {
        role,
      });
      const url =
        response.data.inviteUrl ??
        `${frontendUrl}/invites/${response.data.token}`;
      setInviteLink(url);
      setStatus("Ссылка готова, теперь её можно скопировать.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setStatus("Ссылка скопирована в буфер обмена.");
    } catch {
      setStatus("Не удалось скопировать ссылку, попробуйте вручную.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close modal backdrop"
      />

      <div className="relative w-full max-w-3xl rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-panel backdrop-blur md:p-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Board members
            </p>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              Участники
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
            aria-label="Close modal"
          >
            ✕
          </button>
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Текущие участники</h3>
            {members.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white/40 px-4 py-6 text-sm text-[var(--muted)]">
                Пока никто не добавлен.
              </p>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {member.user.name}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {member.user.email ?? "Email отсутствует"}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                        {member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Сгенерировать инвайт</h3>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Роль приглашённого
              </span>
            </div>

            <form className="space-y-4" onSubmit={handleGenerate}>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Роль</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                  value={role}
                  onChange={(event) => setRole(event.target.value as InviteRole)}
                >
                  {INVITE_ROLES.map((inviteRole) => (
                    <option key={inviteRole} value={inviteRole}>
                      {inviteRole}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isGenerating} className="flex-1">
                  {isGenerating ? "Генерирую…" : "Сгенерировать инвайт"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleCopy} disabled={!inviteLink}>
                  Скопировать
                </Button>
              </div>

              <Input
                label="Ссылка на приглашение"
                value={inviteLink}
                readOnly
                placeholder="Ссылка появится после генерации"
              />

              {status ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</p>
              ) : null}

              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
              ) : null}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
