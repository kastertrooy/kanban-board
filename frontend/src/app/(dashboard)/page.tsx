"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";

import { useDashboard } from "@/components/dashboard/dashboard-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api";

export default function DashboardHomePage() {
  const router = useRouter();
  const { boards, createBoard, isLoadingBoards } = useDashboard();
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedBoards = useMemo(
    () =>
      [...boards].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [boards],
  );

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const board = await createBoard(title);
      setTitle("");
      router.push(`/boards/${board.id}`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4">
          <span className="inline-flex rounded-full bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-dark)]">
            Boards overview
          </span>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
              Keep active work visible, sequenced, and shared.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
              Your sidebar stays in sync with the same board feed used here. Create a
              board once and move straight into its workspace.
            </p>
          </div>
        </Card>

        <Card>
          <form className="space-y-4" onSubmit={handleCreateBoard}>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Create a new board
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Start with a title. Columns and cards can be added next.
              </p>
            </div>
            <Input
              label="Board title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Product launch"
              required
            />
            {error ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={isCreating}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {isCreating ? "Creating board..." : "Create board"}
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Your boards
            </p>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              Workspace overview
            </h2>
          </div>
        </div>

        {isLoadingBoards ? (
          <Card className="text-sm text-[var(--muted)]">Loading boards…</Card>
        ) : orderedBoards.length === 0 ? (
          <Card className="border-dashed text-sm text-[var(--muted)]">
            No boards yet. Create your first board using the panel above.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedBoards.map((board) => (
              <Link key={board.id} href={`/boards/${board.id}`}>
                <Card className="h-full space-y-4 transition hover:-translate-y-0.5 hover:bg-white/90">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Board
                    </p>
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">
                      {board.title}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                    <span>
                      Updated {new Date(board.updatedAt).toLocaleDateString()}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
