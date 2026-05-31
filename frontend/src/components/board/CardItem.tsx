"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, Tag as TagIcon, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Card, FieldValue, FieldValueUser } from "@/store/boardStore";
import { useBoardStore } from "@/store/boardStore";

export function CardItem({
  card,
  isOverlay = false,
}: {
  card: Card;
  isOverlay?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: "card",
      cardId: card.id,
    },
    disabled: isOverlay,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tags = (card.tags ?? []).slice(0, 3).map((t) => t.tag);
  const activeFieldDefinitions = useBoardStore((state) =>
    state.fieldDefinitions
      .filter((field) => !field.deletedAt)
      .sort((a, b) => a.order - b.order),
  );

  const fieldValueByDefId = useMemo(() => {
    const map = new Map<string, FieldValue>();
    for (const value of card.fieldValues ?? []) {
      map.set(value.fieldDefId, value);
    }
    return map;
  }, [card.fieldValues]);

  const fieldBadges = useMemo(() => {
    const items: Array<ReactNode> = [];

    for (const field of activeFieldDefinitions) {
      const value = fieldValueByDefId.get(field.id);
      if (!value) continue;

      if (field.type === "USER") {
        const users = (value.users ?? []).slice(0, 3).map((u: FieldValueUser) => u.user);
        if (users.length === 0) continue;
        items.push(
          <span
            key={`user-${field.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
          >
            <UserRound className="h-3.5 w-3.5" />
            <span className="flex -space-x-2">
              {users.map((user) => {
                const initials = String(user.name ?? user.email ?? "?")
                  .trim()
                  .slice(0, 1)
                  .toUpperCase();
                return (
                  <span
                    key={user.id}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#0f1720] text-[10px] font-semibold text-white"
                    title={user.name ?? user.email}
                  >
                    {initials}
                  </span>
                );
              })}
            </span>
          </span>,
        );
        continue;
      }

      if (field.type === "DATE") {
        if (!value.valueDate) continue;
        const dateText = new Date(value.valueDate).toLocaleDateString();
        items.push(
          <span
            key={`date-${field.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span className="truncate">{dateText}</span>
          </span>,
        );
        continue;
      }

      if (field.type === "SELECT") {
        if (!value.valueText) continue;
        items.push(
          <span
            key={`select-${field.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]/70" />
            <span className="max-w-[140px] truncate">{String(value.valueText)}</span>
          </span>,
        );
        continue;
      }

      if (field.type === "COLOR") {
        if (!value.valueText) continue;
        items.push(
          <span
            key={`color-${field.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
          >
            <span
              className="h-3 w-3 rounded-full border border-[var(--border)]"
              style={{ backgroundColor: String(value.valueText) }}
            />
            <span className="truncate">Color</span>
          </span>,
        );
        continue;
      }

      if (field.type === "NUMBER") {
        if (value.valueNumber === null || value.valueNumber === undefined) continue;
        items.push(
          <span
            key={`number-${field.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-slate-900/20" />
            <span className="truncate">{String(value.valueNumber)}</span>
          </span>,
        );
        continue;
      }

      if (field.type === "TEXT") {
        if (!value.valueText) continue;
        items.push(
          <span
            key={`text-${field.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
            title={value.valueText}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-slate-900/20" />
            <span className="max-w-[140px] truncate">{String(value.valueText)}</span>
          </span>,
        );
        continue;
      }
    }

    return items.slice(0, 2);
  }, [activeFieldDefinitions, fieldValueByDefId]);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group cursor-pointer rounded-2xl border border-[var(--border)] bg-white/80 p-4 shadow-sm transition ${
        isDragging ? "opacity-70" : "opacity-100"
      } ${isOverlay ? "shadow-panel" : "hover:bg-white"}`}
      onClick={() => {
        if (isOverlay || isDragging) return;
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("cardId", card.id);
        const queryString = nextParams.toString();
        router.push(queryString ? `${pathname}?${queryString}` : pathname);
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-white/70 text-[var(--muted)] transition hover:text-[var(--foreground)]"
          {...attributes}
          {...listeners}
          aria-label="Drag card"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">
            {card.title}
          </h4>

          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="max-w-[140px] truncate">{tag.name}</span>
                </span>
              ))}
              {(card.tags?.length ?? 0) > tags.length ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--border)] bg-white/40 px-3 py-1 text-xs text-[var(--muted)]">
                  <TagIcon className="h-3.5 w-3.5" />
                  +{(card.tags?.length ?? 0) - tags.length}
                </span>
              ) : null}
            </div>
          ) : null}

          {fieldBadges.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {fieldBadges}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
