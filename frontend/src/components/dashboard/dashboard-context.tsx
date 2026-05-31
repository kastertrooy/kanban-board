"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { api, isUnauthorizedError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export interface BoardSummary {
  id: string;
  title: string;
  updatedAt: string;
}

type DashboardContextValue = {
  boards: BoardSummary[];
  isLoadingBoards: boolean;
  refreshBoards: () => Promise<void>;
  createBoard: (title: string) => Promise<BoardSummary>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, logout, token, user } = useAuthStore();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);

  const refreshBoards = useCallback(async () => {
    if (!token) {
      setBoards([]);
      setIsLoadingBoards(false);
      return;
    }

    setIsLoadingBoards(true);

    try {
      const response = await api.get<BoardSummary[]>("/boards");
      setBoards(response.data);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        logout();
        router.replace("/login");
        return;
      }
    } finally {
      setIsLoadingBoards(false);
    }
  }, [logout, router, token]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    void refreshBoards();
  }, [hydrated, refreshBoards, router, token]);

  const createBoard = useCallback(
    async (title: string) => {
      const response = await api.post<BoardSummary>("/boards", { title });
      setBoards((currentBoards) => [response.data, ...currentBoards]);
      return response.data;
    },
    [],
  );

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      boards,
      isLoadingBoards,
      refreshBoards,
      createBoard,
    }),
    [boards, createBoard, isLoadingBoards, refreshBoards],
  );

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--panel)] px-5 py-3 text-sm text-[var(--muted)] shadow-panel">
          <FolderKanban className="h-4 w-4" />
          Checking session…
        </div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border)] bg-white/60 p-6 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="sticky top-6 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Workspace
              </p>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Kanban</h1>
            </div>

            <nav className="space-y-2">
              <Link
                href="/"
                className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  pathname === "/"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white/60 text-[var(--foreground)] hover:bg-white"
                }`}
              >
                All boards
              </Link>
              <div className="space-y-2 pt-2">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Your boards
                </p>
                {isLoadingBoards ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-white/50 px-4 py-3 text-sm text-[var(--muted)]">
                    Loading boards…
                  </div>
                ) : boards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
                    No boards yet.
                  </div>
                ) : (
                  boards.map((board) => {
                    const href = `/boards/${board.id}`;
                    const isActive = pathname === href;

                    return (
                      <Link
                        key={board.id}
                        href={href}
                        className={`block rounded-2xl px-4 py-3 text-sm transition ${
                          isActive
                            ? "bg-[#0f1720] text-white"
                            : "bg-white/60 text-[var(--foreground)] hover:bg-white"
                        }`}
                      >
                        <div className="truncate font-medium">{board.title}</div>
                      </Link>
                    );
                  })
                )}
              </div>
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Dashboard
                </p>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {user?.name || user?.email || "Kanban User"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
              >
                Logout
              </button>
            </div>
          </header>

          <div className="px-6 py-6 md:px-8 md:py-8">{children}</div>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }

  return context;
}
