"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useBoardStore } from "@/store/boardStore";

export function CommentList({ cardId }: { cardId: string }) {
  const card = useBoardStore((state) => state.cardsById[cardId]);
  const addComment = useBoardStore((state) => state.addComment);
  const updateComment = useBoardStore((state) => state.updateComment);
  const deleteComment = useBoardStore((state) => state.deleteComment);
  const authUserId = useAuthStore((state) => state.user?.id ?? null);

  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isEditingSaving, setIsEditingSaving] = useState(false);

  if (!card) {
    return null;
  }

  const comments = card.comments ?? [];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await addComment(cardId, draft.trim());
      setDraft("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add comment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingText.trim()) return;
    setIsEditingSaving(true);
    setError(null);
    try {
      await updateComment(cardId, editingId, editingText.trim());
      setEditingId(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update comment");
    } finally {
      setIsEditingSaving(false);
    }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Comments
          </p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Комментарии</h3>
        </div>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-[80px] w-full rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
          placeholder="Оставьте комментарий…"
          disabled={isSaving}
        />
        <div className="flex items-center justify-end gap-2">
          <Button type="submit" disabled={isSaving || !draft.trim()}>
            {isSaving ? "Отправляю…" : "Добавить комментарий"}
          </Button>
        </div>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </form>

      <div className="space-y-3">
        {comments.map((comment) => {
          const isOwn = Boolean(authUserId && comment.authorId === authUserId);
          return (
            <div
              key={comment.id}
              className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/70 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {comment.author?.name ?? comment.author?.email ?? "Аноним"}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
                    {formatDate(comment.createdAt)}
                  </p>
                </div>
                {isOwn ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingText(comment.text);
                      }}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteComment(cardId, comment.id)}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-600 hover:text-rose-600"
                    >
                      Удалить
                    </button>
                  </div>
                ) : null}
              </div>

              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                    disabled={isEditingSaving}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} disabled={isEditingSaving || !editingText.trim()}>
                      {isEditingSaving ? "Сохраняю…" : "Сохранить"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      Отменить
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--foreground)] whitespace-pre-line">{comment.text}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
