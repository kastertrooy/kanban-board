"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, CheckCircle2, Hash, Palette, Trash2, UserRound, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { api, getApiErrorMessage } from "@/lib/api";
import { useBoardStore, type FieldValue, type FieldValueUser } from "@/store/boardStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChecklistView } from "./ChecklistView";
import { CommentList } from "./CommentList";

export function CardModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId");

  const card = useBoardStore((state) => (cardId ? state.cardsById[cardId] : null));
  const fieldDefinitions = useBoardStore((state) => state.fieldDefinitions);
  const members = useBoardStore((state) => state.members);
  const ownerId = useBoardStore((state) => state.ownerId);
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const applyCardUpdated = useBoardStore((state) => state.applyCardUpdated);
  const applyCardDeleted = useBoardStore((state) => state.applyCardDeleted);
  const applyCardFieldUpdated = useBoardStore((state) => state.applyCardFieldUpdated);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  const initialValues = useMemo(() => {
    return {
      title: card?.title ?? "",
      description: card?.description ?? "",
    };
  }, [card?.description, card?.title]);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!cardId) {
      return;
    }

    setTitle(initialValues.title);
    setDescription(initialValues.description);
    setError(null);
    setIsEditingDescription(false);

    const focusTimer = window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 50);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [cardId, initialValues.description, initialValues.title]);

  useEffect(() => {
    if (!isEditingDescription) return;
    const timer = window.setTimeout(() => {
      descriptionInputRef.current?.focus();
    }, 50);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isEditingDescription]);

  useEffect(() => {
    if (!cardId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cardId]);

  if (!cardId) {
    return null;
  }

  function close() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("cardId");
    const queryString = nextParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }

  async function savePatch(patch: { title?: string; description?: string }) {
    if (!cardId || !card) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await api.patch(`/cards/${cardId}`, patch);
      applyCardUpdated(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!cardId || !card) return;

    const ok = window.confirm("Удалить карточку? Это действие нельзя отменить.");
    if (!ok) return;

    setIsSaving(true);
    setError(null);

    try {
      await api.delete(`/cards/${cardId}`);
      applyCardDeleted({ id: cardId, columnId: card.columnId });
      close();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  const hasTitleChanges = title.trim() !== initialValues.title;
  const hasDescriptionChanges = description !== initialValues.description;

  async function handleDescriptionBlur() {
    if (!cardId) return;
    if (hasDescriptionChanges) {
      await savePatch({ description: description.trim() });
    } else {
      setDescription(initialValues.description);
    }
    setIsEditingDescription(false);
  }

  const activeFieldDefinitions = useMemo(() => {
    return fieldDefinitions
      .filter((field) => !field.deletedAt)
      .sort((a, b) => a.order - b.order);
  }, [fieldDefinitions]);

  const fieldValueByDefId = useMemo(() => {
    const map = new Map<string, FieldValue>();
    for (const value of card?.fieldValues ?? []) {
      map.set(value.fieldDefId, value);
    }
    return map;
  }, [card?.fieldValues]);

  const canEditFieldValues = useMemo(() => {
    if (!authUserId) return false;
    if (ownerId && ownerId === authUserId) return true;
    const membership = members.find((m) => m.user.id === authUserId);
    return membership?.role === "OWNER" || membership?.role === "EDITOR";
  }, [authUserId, members, ownerId]);

  async function upsertFieldValue(fieldId: string, body: Record<string, unknown>) {
    if (!cardId) return;
    if (!canEditFieldValues) {
      setError("Недостаточно прав для изменения значений полей (нужен OWNER/EDITOR).");
      return;
    }
    setError(null);

    try {
      const response = await api.post<FieldValue>(`/cards/${cardId}/fields/${fieldId}`, body);
      const fieldValue = response.data;
      applyCardFieldUpdated({
        cardId,
        fieldId,
        fieldValue,
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  function toDateInputValue(value: string | null | undefined): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={close}
        role="button"
        tabIndex={-1}
        aria-label="Close modal backdrop"
      />

      <div className="relative w-full max-w-2xl rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-panel backdrop-blur md:p-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Card
            </p>
            <h2 className="truncate text-2xl font-semibold text-[var(--foreground)]">
              {card?.title ?? "Card"}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {!card ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-4 text-sm text-[var(--muted)]">
            Loading card…
          </div>
        ) : (
          <div className="space-y-6">
            <Input
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                if (hasTitleChanges && title.trim()) {
                  void savePatch({ title: title.trim() });
                } else {
                  setTitle(initialValues.title);
                }
              }}
              ref={(node) => {
                titleInputRef.current = node;
              }}
              disabled={isSaving}
            />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--foreground)]">Description</span>
                <button
                  type="button"
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                  onClick={() => {
                    if (isEditingDescription) {
                      void handleDescriptionBlur();
                    } else {
                      setIsEditingDescription(true);
                    }
                  }}
                >
                  {isEditingDescription ? "Предпросмотр" : "Редактировать"}
                </button>
              </div>

              {isEditingDescription ? (
                <label className="flex w-full flex-col gap-2">
                  <textarea
                    className="min-h-[140px] w-full resize-y rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    onBlur={() => {
                      void handleDescriptionBlur();
                    }}
                    placeholder="Add details…"
                    disabled={isSaving}
                    ref={(node) => {
                      descriptionInputRef.current = node;
                    }}
                  />
                </label>
              ) : (
                <div
                  className="min-h-[140px] w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-4 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-white/60"
                  onClick={() => setIsEditingDescription(true)}
                >
                  {description.trim() ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="space-y-2 text-sm text-[var(--foreground)]"
                    >
                      {description}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Описание отсутствует. Нажмите, чтобы добавить.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Custom fields</h3>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  {activeFieldDefinitions.length} fields
                </p>
              </div>

              {activeFieldDefinitions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/40 px-4 py-6 text-sm text-[var(--muted)]">
                  No custom fields configured for this board.
                </div>
              ) : (
                <div className="grid gap-4">
                  {activeFieldDefinitions.map((field) => {
                    const fieldValue = fieldValueByDefId.get(field.id);

                    if (field.type === "USER") {
                      const selected = (fieldValue?.users ?? []).map((u: FieldValueUser) => u.userId);
                      return (
                        <label key={field.id} className="flex flex-col gap-2">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                            <UserRound className="h-4 w-4 text-[var(--muted)]" />
                            {field.name}
                          </span>
                          <select
                            multiple
                            className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                            value={selected}
                            onChange={(event) => {
                              const userIds = Array.from(event.target.selectedOptions).map((opt) => opt.value);
                              void upsertFieldValue(field.id, { userIds });
                            }}
                            disabled={isSaving || !canEditFieldValues}
                          >
                            {members.map((member) => (
                              <option key={member.user.id} value={member.user.id}>
                                {member.user.name} ({member.user.email ?? "no-email"})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-[var(--muted)]">
                            Hold Ctrl/Command to select multiple users.
                          </p>
                        </label>
                      );
                    }

                    if (field.type === "DATE") {
                      const value = toDateInputValue(fieldValue?.valueDate);
                      return (
                        <label key={field.id} className="flex flex-col gap-2">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                            <Calendar className="h-4 w-4 text-[var(--muted)]" />
                            {field.name}
                          </span>
                          <input
                            type="date"
                            className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                            defaultValue={value}
                            onChange={(event) => {
                              const next = event.target.value;
                              if (!next) {
                                void upsertFieldValue(field.id, {});
                                return;
                              }
                              void upsertFieldValue(field.id, {
                                valueDate: new Date(next).toISOString(),
                              });
                            }}
                            disabled={isSaving || !canEditFieldValues}
                          />
                        </label>
                      );
                    }

                    if (field.type === "NUMBER") {
                      const value = fieldValue?.valueNumber ?? "";
                      return (
                        <label key={field.id} className="flex flex-col gap-2">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                            <Hash className="h-4 w-4 text-[var(--muted)]" />
                            {field.name}
                          </span>
                          <input
                            type="number"
                            defaultValue={value}
                            className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                            onBlur={(event) => {
                              const raw = event.target.value.trim();
                              if (!raw) {
                                void upsertFieldValue(field.id, {});
                                return;
                              }
                              const parsed = Number(raw);
                              if (Number.isNaN(parsed)) return;
                              void upsertFieldValue(field.id, { valueNumber: parsed });
                            }}
                            disabled={isSaving || !canEditFieldValues}
                          />
                        </label>
                      );
                    }

                    if (field.type === "SELECT") {
                      const options = Array.isArray(field.options)
                        ? field.options.filter((opt): opt is string => typeof opt === "string")
                        : [];
                      const selected = fieldValue?.valueText ?? "";
                      return (
                        <label key={field.id} className="flex flex-col gap-2">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                            <CheckCircle2 className="h-4 w-4 text-[var(--muted)]" />
                            {field.name}
                          </span>
                          <select
                            className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                            value={selected}
                            onChange={(event) => {
                              const next = event.target.value;
                              if (!next) {
                                void upsertFieldValue(field.id, {});
                                return;
                              }
                              void upsertFieldValue(field.id, { valueText: next });
                            }}
                            disabled={isSaving || !canEditFieldValues}
                          >
                            <option value="">None</option>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    }

                    if (field.type === "COLOR") {
                      const value = fieldValue?.valueText ?? "#000000";
                      return (
                        <label key={field.id} className="flex flex-col gap-2">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                            <Palette className="h-4 w-4 text-[var(--muted)]" />
                            {field.name}
                          </span>
                          <input
                            type="color"
                            defaultValue={value}
                            className="h-12 w-20 rounded-xl border border-[var(--border)] bg-white/80 p-1"
                            onChange={(event) => {
                              void upsertFieldValue(field.id, { valueText: event.target.value });
                            }}
                            disabled={isSaving || !canEditFieldValues}
                          />
                        </label>
                      );
                    }

                    // TEXT
                    const valueText = fieldValue?.valueText ?? "";
                    return (
                      <label key={field.id} className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-[var(--foreground)]">{field.name}</span>
                        <input
                          className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white"
                          defaultValue={valueText}
                          placeholder="Enter value"
                          onBlur={(event) => {
                            const next = event.target.value;
                            if (!next.trim()) {
                              void upsertFieldValue(field.id, {});
                              return;
                            }
                            void upsertFieldValue(field.id, { valueText: next.trim() });
                          }}
                          disabled={isSaving || !canEditFieldValues}
                        />
                      </label>
                    );
                  })}
                </div>
            )}
          </section>

            <ChecklistView cardId={card.id} />
            <CommentList cardId={card.id} />

            {error ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="danger"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={handleDelete}
                disabled={isSaving}
              >
                Delete
              </Button>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={close}
                  disabled={isSaving}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const patch: { title?: string; description?: string } = {};
                    if (hasTitleChanges && title.trim()) patch.title = title.trim();
                    if (hasDescriptionChanges) patch.description = description.trim();
                    if (Object.keys(patch).length > 0) void savePatch(patch);
                  }}
                  disabled={isSaving || (!hasTitleChanges && !hasDescriptionChanges)}
                >
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
