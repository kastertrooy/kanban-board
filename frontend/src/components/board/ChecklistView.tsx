"use client";

import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoardStore } from "@/store/boardStore";

export function ChecklistView({ cardId }: { cardId: string }) {
  const card = useBoardStore((state) => state.cardsById[cardId]);
  const checklists = card?.checklists ?? [];
  const createChecklist = useBoardStore((state) => state.createChecklist);
  const deleteChecklist = useBoardStore((state) => state.deleteChecklist);
  const addChecklistItem = useBoardStore((state) => state.addChecklistItem);
  const updateChecklistItem = useBoardStore((state) => state.updateChecklistItem);
  const deleteChecklistItem = useBoardStore((state) => state.deleteChecklistItem);

  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [itemLoading, setItemLoading] = useState<Record<string, boolean>>({});

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await createChecklist(cardId, newTitle.trim());
      setNewTitle("");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create checklist");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddItem = async (checklistId: string, text: string) => {
    if (!text.trim()) return;
    setItemLoading((prev) => ({ ...prev, [checklistId]: true }));
    try {
      await addChecklistItem(cardId, checklistId, text.trim());
      setItemDrafts((prev) => ({ ...prev, [checklistId]: "" }));
    } finally {
      setItemLoading((prev) => ({ ...prev, [checklistId]: false }));
    }
  };

  if (!card) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Checklist
          </p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Чек-листы</h3>
        </div>
        <form className="flex w-full max-w-sm items-center gap-3" onSubmit={handleCreate}>
          <Input
            label="Новая секция"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Название чек-листа"
            disabled={isCreating}
            className="text-sm"
          />
          <Button type="submit" disabled={isCreating || !newTitle.trim()} leftIcon={<Plus className="h-4 w-4" />}>
            {isCreating ? "Создаю…" : "Добавить"}
          </Button>
        </form>
      </div>

      {createError ? (
        <p className="text-sm text-rose-600">{createError}</p>
      ) : null}

      {checklists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/40 px-4 py-6 text-sm text-[var(--muted)]">
          У этой карточки ещё нет чек-листов.
        </div>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const total = checklist.items.length;
            const done = checklist.items.filter((item) => item.isDone).length;
            const progress = total === 0 ? 0 : Math.round((done / total) * 100);
            const draft = itemDrafts[checklist.id] ?? "";
            const isItemLoading = itemLoading[checklist.id] ?? false;

            return (
              <div key={checklist.id} className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--foreground)]">{checklist.title}</h4>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                      {progress}% готово
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteChecklist(cardId, checklist.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
                    aria-label="Удалить чек-лист"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-white/60">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="space-y-3">
                  {checklist.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/60 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item.isDone}
                        onChange={() =>
                          updateChecklistItem(cardId, checklist.id, item.id, { isDone: !item.isDone })
                        }
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span
                        className={`flex-1 text-sm ${item.isDone ? "text-[var(--muted)] line-through" : ""}`}
                      >
                        {item.text || "Без названия"}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteChecklistItem(cardId, checklist.id, item.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
                        aria-label="Удалить пункт"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAddItem(checklist.id, draft);
                  }}
                >
                  <input
                    value={draft}
                    onChange={(event) =>
                      setItemDrafts((prev) => ({ ...prev, [checklist.id]: event.target.value }))
                    }
                    placeholder="Добавить пункт"
                    className="flex-1 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                    disabled={isItemLoading}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={isItemLoading || !draft.trim()}
                    className="whitespace-nowrap"
                  >
                    {isItemLoading ? "Сохраняю…" : "Добавить"}
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
