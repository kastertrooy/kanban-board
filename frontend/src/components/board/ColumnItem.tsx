"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Grip, Plus, PlusCircle } from "lucide-react";
import { FormEvent, useState } from "react";

import type { Card, Column } from "@/store/boardStore";
import { CardItem } from "./CardItem";
import { api, getApiErrorMessage } from "@/lib/api";
import { useBoardStore } from "@/store/boardStore";

export function ColumnItem({
  column,
  cards,
  isOverlay = false,
}: {
  column: Column;
  cards: Card[];
  isOverlay?: boolean;
}) {
  const applyCardCreated = useBoardStore((state) => state.applyCardCreated);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: "column",
      columnId: column.id,
    },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`flex w-[320px] shrink-0 flex-col gap-4 rounded-[1.75rem] border border-[var(--border)] bg-white/55 p-5 shadow-sm backdrop-blur ${
        isDragging ? "opacity-70" : "opacity-100"
      } ${isOverlay ? "shadow-panel" : ""}`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Column
          </p>
          <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
            {column.title}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--muted)]">
            {column.cardIds.length}
          </span>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
            aria-label="Add card"
            disabled
            title="Card creation UI comes next"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
            {...attributes}
            {...listeners}
            aria-label="Drag column"
          >
            <Grip className="h-4 w-4" />
          </button>
        </div>
      </header>

      <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3">
          {cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/35 px-4 py-6 text-sm text-[var(--muted)]">
              Drop cards here
            </div>
          ) : (
            cards.map((card) => <CardItem key={card.id} card={card} />)
          )}
        </div>
      </SortableContext>

      {isOverlay ? null : (
        <div className="space-y-3">
          {isAdding ? (
            <form
              className="space-y-2"
              onSubmit={async (event: FormEvent) => {
                event.preventDefault();
                if (!title.trim()) return;
                setIsSubmitting(true);
                setError(null);
                try {
                  const response = await api.post("/cards", {
                    boardId: column.boardId,
                    columnId: column.id,
                    title: title.trim(),
                  });
                  applyCardCreated(response.data);
                  setTitle("");
                  setIsAdding(false);
                } catch (requestError) {
                  setError(getApiErrorMessage(requestError));
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <input
                className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white"
                placeholder="Card title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
                disabled={isSubmitting}
              />
              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:opacity-60"
                >
                  {isSubmitting ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setTitle("");
                    setError(null);
                  }}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-white/45 px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
            >
              <PlusCircle className="h-4 w-4" />
              Add card
            </button>
          )}
        </div>
      )}
    </section>
  );
}
