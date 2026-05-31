"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { api, getApiErrorMessage } from "@/lib/api";

const TELEGRAM_BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "kanban_bot";

type InviteInfo = {
  token: string;
  role: "EDITOR" | "VIEWER";
  board: {
    title: string;
    owner?: {
      name: string | null;
      avatarUrl: string | null;
    };
  };
};

export default function InviteAcceptPage({
  params,
}: {
  params: {
    token: string;
  };
}) {
  const { token } = params;
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void api
      .get<InviteInfo>(`/invites/${token}`)
      .then((response) => {
        if (!cancelled) {
          setInvite(response.data);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const telegramLink = useMemo(() => {
    if (!token) return "";
    return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=invite_${token}`;
  }, [token]);

  const body = useMemo(() => {
    if (isLoading) {
      return <p className="text-sm text-[var(--muted)]">Загружаем приглашение...</p>;
    }

    if (error) {
      return <p className="text-sm text-rose-700">{error}</p>;
    }

    if (!invite) {
      return <p className="text-sm text-[var(--muted)]">Приглашение не найдено.</p>;
    }

    return (
      <>
        <p className="text-sm text-[var(--muted)]">
          Вас пригласили на доску&nbsp;
          <span className="font-semibold text-[var(--foreground)]">{invite.board.title}</span>
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Роль: {invite.role}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              window.location.href = telegramLink;
            }}
            className="w-full"
          >
            Принять приглашение через Telegram
          </Button>
          <p className="text-xs text-[var(--muted)]">
            Мы ещё и отправим магическую ссылку в Telegram, чтобы ускорить вход.
          </p>
        </div>
      </>
    );
  }, [error, invite, isLoading, telegramLink]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-6 rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-8 text-center shadow-panel">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Invite
          </p>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            Добро пожаловать на доску
          </h1>
        </div>
        {body}
        <p className="text-xs text-[var(--muted)]">
          Бот: из приложения Telegram откройте @{TELEGRAM_BOT_USERNAME}
        </p>
      </div>
    </div>
  );
}
