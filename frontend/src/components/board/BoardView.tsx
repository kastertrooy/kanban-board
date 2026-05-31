"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { FormEvent, useMemo, useRef, useState } from "react";
import { LayoutGrid, Loader2, PlusSquare, SlidersHorizontal } from "lucide-react";

import { api, getApiErrorMessage } from "@/lib/api";
import { useBoardStore, type BoardSnapshot, type Card as BoardCard } from "@/store/boardStore";
import { ColumnItem } from "./ColumnItem";
import { CardItem } from "./CardItem";
import { CardModal } from "./CardModal";

type ActiveDrag =
  | { type: "column"; columnId: string }
  | { type: "card"; cardId: string }
  | null;

export function BoardView({
  boardId,
  canManageFields = false,
  canManageMembers = false,
  onOpenMembers,
  onOpenFieldSettings,
}: {
  boardId: string;
  canManageFields?: boolean;
  canManageMembers?: boolean;
  onOpenMembers?: () => void;
  onOpenFieldSettings?: () => void;
}) {
  const {
    title,
    columnsOrder,
    columnsById,
    cardsById,
    isLoading,
    error,
    reorderColumns,
    moveCardLocal,
    snapshot,
    restore,
    applyColumnCreated,
  } = useBoardStore();

  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const snapshotRef = useRef<BoardSnapshot | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [columnError, setColumnError] = useState<string | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 220,
        tolerance: 6,
      },
    }),
  );

  const columns = useMemo(
    () => columnsOrder.map((id) => columnsById[id]).filter(Boolean),
    [columnsById, columnsOrder],
  );

  const columnCards = useMemo(() => {
    const result: Record<string, BoardCard[]> = {};
    for (const column of columns) {
      result[column.id] = column.cardIds
        .map((id) => cardsById[id])
        .filter((card): card is BoardCard => Boolean(card))
        .sort((a, b) => a.order - b.order);
    }
    return result;
  }, [cardsById, columns]);

  function findColumnIdByCardId(cardId: string): string | null {
    const card = cardsById[cardId];
    return card?.columnId ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    snapshotRef.current = snapshot();
    lastErrorRef.current = null;

    const activeId = String(event.active.id);
    const activeType = event.active.data.current?.type;
    if (activeType === "column") {
      setActiveDrag({ type: "column", columnId: activeId });
      return;
    }
    if (activeType === "card") {
      setActiveDrag({ type: "card", cardId: activeId });
      return;
    }

    // Фоллбек по совпадению id.
    if (columnsById[activeId]) {
      setActiveDrag({ type: "column", columnId: activeId });
    } else if (cardsById[activeId]) {
      setActiveDrag({ type: "card", cardId: activeId });
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const activeType = event.active.data.current?.type;
    if (activeType !== "card") return;
    if (!event.over) return;

    const activeCardId = String(event.active.id);
    const overId = String(event.over.id);

    const fromColumnId = findColumnIdByCardId(activeCardId);
    if (!fromColumnId) return;

    const overType = event.over.data.current?.type;
    if (overType === "column") {
      const toColumnId = overId;
      const toColumn = columnsById[toColumnId];
      if (!toColumn) return;
      const toIndex = toColumn.cardIds.length;
      moveCardLocal(activeCardId, toColumnId, toIndex);
      return;
    }

    const toColumnId = findColumnIdByCardId(overId);
    if (!toColumnId) return;

    const toColumn = columnsById[toColumnId];
    if (!toColumn) return;

    const overIndex = toColumn.cardIds.indexOf(overId);
    const toIndex = overIndex < 0 ? toColumn.cardIds.length : overIndex;

    // Перемещение между колонками (и сортировка внутри) для live-preview.
    moveCardLocal(activeCardId, toColumnId, toIndex);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const active = event.active;
    const over = event.over;

    setActiveDrag(null);

    if (!over) {
      if (snapshotRef.current) restore(snapshotRef.current);
      snapshotRef.current = null;
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    const rollback = () => {
      if (snapshotRef.current) restore(snapshotRef.current);
      snapshotRef.current = null;
    };

    try {
      if (activeType === "column") {
        if (activeId === overId) {
          snapshotRef.current = null;
          return;
        }

        reorderColumns(activeId, overId);
        const nextOrder = useBoardStore.getState().columnsOrder;

        await api.patch("/columns/reorder", {
          columns: nextOrder.map((id, index) => ({ id, order: index })),
        });

        snapshotRef.current = null;
        return;
      }

      if (activeType === "card") {
        const toColumnId =
          overType === "column"
            ? overId
            : findColumnIdByCardId(overId);

        if (!toColumnId) {
          rollback();
          return;
        }

        const targetColumn = useBoardStore.getState().columnsById[toColumnId];
        if (!targetColumn) {
          rollback();
          return;
        }

        const toIndex =
          overType === "column"
            ? targetColumn.cardIds.length - 1
            : Math.max(0, targetColumn.cardIds.indexOf(overId));

        // Финализируем локальное состояние (на случай если DragOver не вызывался).
        moveCardLocal(activeId, toColumnId, toIndex);

        await api.patch(`/cards/${activeId}/move`, {
          columnId: toColumnId,
          order: clampIndex(toIndex, useBoardStore.getState().columnsById[toColumnId].cardIds.length - 1),
        });

        snapshotRef.current = null;
      }
    } catch (error) {
      lastErrorRef.current = getApiErrorMessage(error);
      rollback();
    }
  }

  const overlay = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.type === "column") {
      const column = columnsById[activeDrag.columnId];
      if (!column) return null;
      const cards = column.cardIds
        .map((id) => cardsById[id])
        .filter((card): card is BoardCard => Boolean(card));
      return <ColumnItem column={column} cards={cards} isOverlay />;
    }
    const card = cardsById[activeDrag.cardId];
    if (!card) return null;
    return <CardItem card={card} isOverlay />;
  }, [activeDrag, cardsById, columnsById]);

  if (isLoading && columnsOrder.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--panel)] px-5 py-3 text-sm text-[var(--muted)] shadow-panel">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading board…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-6 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Board
          </p>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-[var(--foreground)]">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f1720] text-white">
              <LayoutGrid className="h-5 w-5" />
            </span>
            {title ?? "Board"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {canManageMembers && onOpenMembers ? (
            <button
              type="button"
              onClick={onOpenMembers}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
            >
              Участники
            </button>
          ) : null}
          {canManageFields && onOpenFieldSettings ? (
            <button
              type="button"
              onClick={onOpenFieldSettings}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Настройки полей
            </button>
          ) : null}

          {lastErrorRef.current ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {lastErrorRef.current}
            </div>
          ) : null}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columnsOrder} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-6">
            {columns.map((column) => (
              <ColumnItem
                key={column.id}
                column={column}
                cards={columnCards[column.id] ?? []}
              />
            ))}

            <div className="w-[320px] shrink-0">
              {isAddingColumn ? (
                <form
                  className="flex flex-col gap-2 rounded-[1.75rem] border border-[var(--border)] bg-white/55 p-5 shadow-sm backdrop-blur"
                  onSubmit={async (event: FormEvent) => {
                    event.preventDefault();
                    if (!newColumnTitle.trim()) return;
                    setIsCreatingColumn(true);
                    setColumnError(null);
                    try {
                      const response = await api.post("/columns", {
                        boardId,
                        title: newColumnTitle.trim(),
                      });
                      applyColumnCreated(response.data);
                      setNewColumnTitle("");
                      setIsAddingColumn(false);
                    } catch (requestError) {
                      setColumnError(getApiErrorMessage(requestError));
                    } finally {
                      setIsCreatingColumn(false);
                    }
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    New column
                  </p>
                  <input
                    className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white"
                    placeholder="Column title"
                    value={newColumnTitle}
                    onChange={(event) => setNewColumnTitle(event.target.value)}
                    autoFocus
                    disabled={isCreatingColumn}
                  />
                  {columnError ? (
                    <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {columnError}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isCreatingColumn}
                      className="flex-1 rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:opacity-60"
                    >
                      {isCreatingColumn ? "Adding…" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingColumn(false);
                        setNewColumnTitle("");
                        setColumnError(null);
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
                  onClick={() => setIsAddingColumn(true)}
                  className="flex h-full min-h-[180px] w-full items-center justify-center gap-2 rounded-[1.75rem] border border-dashed border-[var(--border)] bg-white/35 px-6 py-8 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
                >
                  <PlusSquare className="h-5 w-5" />
                  Add column
                </button>
              )}
            </div>
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
      </DndContext>

      <CardModal />
    </div>
  );
}

function clampIndex(value: number, max: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}
