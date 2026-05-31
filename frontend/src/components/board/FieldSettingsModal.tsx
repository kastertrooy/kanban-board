"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoardStore, type FieldDefinition } from "@/store/boardStore";

const FIELD_TYPES: Array<FieldDefinition["type"]> = [
  "USER",
  "DATE",
  "TEXT",
  "NUMBER",
  "SELECT",
  "COLOR",
];

function parseSelectOptions(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionsToString(options: unknown | null): string {
  if (!options) return "";
  if (Array.isArray(options) && options.every((item) => typeof item === "string")) {
    return options.join(", ");
  }
  return "";
}

export function FieldSettingsModal({
  boardId,
  isOpen,
  onClose,
  canManageFields,
}: {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  canManageFields: boolean;
}) {
  const fieldDefinitions = useBoardStore((state) => state.fieldDefinitions);
  const applyFieldDefinitionCreated = useBoardStore((state) => state.applyFieldDefinitionCreated);
  const applyFieldDefinitionUpdated = useBoardStore((state) => state.applyFieldDefinitionUpdated);
  const applyFieldDefinitionDeleted = useBoardStore((state) => state.applyFieldDefinitionDeleted);

  const [name, setName] = useState("");
  const [type, setType] = useState<FieldDefinition["type"]>("TEXT");
  const [isRequired, setIsRequired] = useState(false);
  const [selectOptions, setSelectOptions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFields = useMemo(() => {
    return [...fieldDefinitions].sort((a, b) => a.order - b.order);
  }, [fieldDefinitions]);

  if (!isOpen) return null;

  async function createField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canManageFields) {
      setError("Недостаточно прав для управления полями.");
      return;
    }

    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: {
        name: string;
        type: FieldDefinition["type"];
        isRequired: boolean;
        options?: string[];
      } = {
        name: name.trim(),
        type,
        isRequired,
      };

      if (type === "SELECT") {
        payload.options = parseSelectOptions(selectOptions);
      }

      const response = await api.post<FieldDefinition>(`/boards/${boardId}/fields`, payload);
      applyFieldDefinitionCreated(response.data);
      setName("");
      setType("TEXT");
      setIsRequired(false);
      setSelectOptions("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateField(fieldId: string, patch: Partial<FieldDefinition>) {
    if (!canManageFields) {
      setError("Недостаточно прав для управления полями.");
      return;
    }

    setError(null);
    try {
      const response = await api.patch<FieldDefinition>(
        `/boards/${boardId}/fields/${fieldId}`,
        {
          name: patch.name,
          isRequired: patch.isRequired,
          options: patch.options,
        },
      );
      applyFieldDefinitionUpdated(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  async function deleteField(fieldId: string) {
    if (!canManageFields) {
      setError("Недостаточно прав для управления полями.");
      return;
    }

    const ok = window.confirm("Удалить поле? Значения в старых карточках останутся, но поле исчезнет из UI.");
    if (!ok) return;

    setError(null);
    try {
      await api.delete(`/boards/${boardId}/fields/${fieldId}`);
      applyFieldDefinitionDeleted({ fieldId, deletedAt: new Date().toISOString() });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
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
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Board settings
            </p>
            <h2 className="truncate text-2xl font-semibold text-[var(--foreground)]">
              Настройки полей
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {error ? (
          <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Текущие поля</h3>
            {activeFields.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/40 px-4 py-6 text-sm text-[var(--muted)]">
                Пока нет кастомных полей.
              </div>
            ) : (
              <div className="space-y-3">
                {activeFields.map((field) => {
                  const isDeleted = Boolean(field.deletedAt);
                  const isSelect = field.type === "SELECT";

                  return (
                    <div
                      key={field.id}
                      className={`rounded-2xl border border-[var(--border)] bg-white/60 p-4 ${
                        isDeleted ? "opacity-60" : "opacity-100"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                              {field.type}
                            </span>
                            {field.isRequired ? (
                              <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-dark)]">
                                Required
                              </span>
                            ) : null}
                            {isDeleted ? (
                              <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                                Deleted
                              </span>
                            ) : null}
                          </div>

                          <Input
                            label="Название"
                            defaultValue={field.name}
                            disabled={isDeleted || !canManageFields}
                            onBlur={(event) => {
                              const nextName = event.target.value.trim();
                              if (!nextName || nextName === field.name) return;
                              void updateField(field.id, { name: nextName });
                            }}
                          />

                          <label className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-[var(--foreground)]">
                              Обязательное
                            </span>
                            <input
                              type="checkbox"
                              className="h-5 w-5 accent-[var(--accent)]"
                              defaultChecked={field.isRequired}
                              disabled={isDeleted || !canManageFields}
                              onChange={(event) => {
                                void updateField(field.id, { isRequired: event.target.checked });
                              }}
                            />
                          </label>

                          {isSelect ? (
                            <label className="flex flex-col gap-2">
                              <span className="text-sm font-medium text-[var(--foreground)]">
                                Options (через запятую)
                              </span>
                              <input
                                className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white"
                                defaultValue={optionsToString(field.options)}
                                disabled={isDeleted || !canManageFields}
                                placeholder="Todo, In progress, Done"
                                onBlur={(event) => {
                                  const raw = event.target.value;
                                  const parsed = parseSelectOptions(raw);
                                  void updateField(field.id, { options: parsed });
                                }}
                              />
                            </label>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => void deleteField(field.id)}
                          disabled={isDeleted || !canManageFields}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 text-rose-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Delete field"
                          title="Delete field"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Добавить поле</h3>
            <form className="space-y-4" onSubmit={createField}>
              <Input
                label="Название"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Deadline / Assignees / Status"
                disabled={isSubmitting || !canManageFields}
                required
              />

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Тип</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                  value={type}
                  onChange={(event) => setType(event.target.value as FieldDefinition["type"])}
                  disabled={isSubmitting || !canManageFields}
                >
                  {FIELD_TYPES.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {fieldType}
                    </option>
                  ))}
                </select>
              </label>

              {type === "SELECT" ? (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    Options (через запятую)
                  </span>
                  <input
                    className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white"
                    value={selectOptions}
                    onChange={(event) => setSelectOptions(event.target.value)}
                    placeholder="Todo, In progress, Done"
                    disabled={isSubmitting || !canManageFields}
                    required
                  />
                </label>
              ) : null}

              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--foreground)]">Обязательное</span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--accent)]"
                  checked={isRequired}
                  onChange={(event) => setIsRequired(event.target.checked)}
                  disabled={isSubmitting || !canManageFields}
                />
              </label>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !canManageFields}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                {isSubmitting ? "Создаю…" : "Добавить поле"}
              </Button>

              {!canManageFields ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Только OWNER или EDITOR могут менять структуру полей.
                </p>
              ) : null}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
