"use client";

import { create } from "zustand";

import { api } from "@/lib/api";

export type BoardMember = {
  id: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  user: {
    id: string;
    email: string | null;
    name: string;
    avatarUrl: string | null;
  };
};

export type Tag = {
  id: string;
  name: string;
  color: string;
};

export type CardTag = {
  tag: Tag;
};

export type Card = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  tags?: CardTag[];
  fieldValues?: FieldValue[];
  checklists?: Checklist[];
  comments?: Comment[];
};

export type Column = {
  id: string;
  boardId: string;
  title: string;
  order: number;
  cardIds: string[];
};

export type FieldDefinition = {
  id: string;
  boardId: string;
  name: string;
  type: "USER" | "DATE" | "TEXT" | "NUMBER" | "SELECT" | "COLOR";
  isRequired: boolean;
  options: unknown | null;
  order: number;
  deletedAt: string | null;
};

export type FieldValueUser = {
  userId: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    avatarUrl: string | null;
  };
};

export type FieldValue = {
  id: string;
  cardId: string;
  fieldDefId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  users: FieldValueUser[];
};

export type ChecklistItem = {
  id: string;
  checklistId: string;
  text: string;
  isDone: boolean;
  order: number;
  createdAt: string;
  updatedAt?: string;
};

export type Checklist = {
  id: string;
  cardId: string;
  title: string;
  order: number;
  items: ChecklistItem[];
};

export type CommentAuthor = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

export type Comment = {
  id: string;
  cardId: string;
  authorId: string | null;
  text: string;
  createdAt: string;
  updatedAt?: string;
  author: CommentAuthor | null;
};

export type BoardDetailsResponse = {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: BoardMember[];
  tags: Tag[];
  columns: Array<{
    id: string;
    boardId: string;
    title: string;
    order: number;
    cards: Card[];
  }>;
  cards: Card[];
  fieldDefinitions?: FieldDefinition[];
};

export type BoardSnapshot = {
  boardId: string | null;
  title: string | null;
  columnsOrder: string[];
  columnsById: Record<string, Column>;
  cardsById: Record<string, Card>;
  fieldDefinitions: FieldDefinition[];
};

type BoardState = {
  isLoading: boolean;
  error: string | null;
  boardId: string | null;
  title: string | null;
  ownerId: string | null;
  members: BoardMember[];
  columnsOrder: string[];
  columnsById: Record<string, Column>;
  cardsById: Record<string, Card>;
  fieldDefinitions: FieldDefinition[];
  loadBoard: (boardId: string) => Promise<void>;
  setBoardFromApi: (data: BoardDetailsResponse) => void;
  snapshot: () => BoardSnapshot;
  restore: (snapshot: BoardSnapshot) => void;
  reorderColumns: (activeColumnId: string, overColumnId: string) => void;
  moveCardLocal: (cardId: string, toColumnId: string, toIndex: number) => void;
  applyColumnCreated: (column: { id: string; boardId: string; title: string; order: number }) => void;
  applyColumnUpdated: (column: { id: string; title?: string; order?: number }) => void;
  applyColumnDeleted: (payload: { id: string }) => void;
  applyColumnReordered: (payload: { columns: Array<{ id: string; order: number; title: string; boardId: string }> }) => void;
  applyCardCreated: (card: Card) => void;
  applyCardUpdated: (card: Card) => void;
  applyCardDeleted: (payload: { id: string; columnId?: string }) => void;
  applyCardMoved: (card: Card) => void;
  applyFieldDefinitionCreated: (field: FieldDefinition) => void;
  applyFieldDefinitionUpdated: (field: FieldDefinition) => void;
  applyFieldDefinitionDeleted: (payload: { fieldId: string; deletedAt?: string }) => void;
  applyCardFieldUpdated: (payload: { cardId: string; fieldId: string; fieldValue: FieldValue }) => void;
  createChecklist: (cardId: string, title: string) => Promise<void>;
  deleteChecklist: (cardId: string, checklistId: string) => Promise<void>;
  addChecklistItem: (cardId: string, checklistId: string, text: string) => Promise<void>;
  updateChecklistItem: (
    cardId: string,
    checklistId: string,
    itemId: string,
    payload: {
      text?: string;
      isDone?: boolean;
      order?: number;
    },
  ) => Promise<void>;
  deleteChecklistItem: (cardId: string, checklistId: string, itemId: string) => Promise<void>;
  addComment: (cardId: string, text: string) => Promise<void>;
  updateComment: (cardId: string, commentId: string, text: string) => Promise<void>;
  deleteComment: (cardId: string, commentId: string) => Promise<void>;
  applyChecklistCreated: (payload: { cardId: string; checklist: Checklist }) => void;
  applyChecklistDeleted: (payload: { cardId: string; checklistId: string }) => void;
  applyChecklistItemAdded: (payload: { cardId: string; checklistId: string; item: ChecklistItem }) => void;
  applyChecklistItemUpdated: (payload: { cardId: string; checklistId: string; item: ChecklistItem }) => void;
  applyChecklistItemDeleted: (payload: { cardId: string; checklistId: string; itemId: string }) => void;
  applyCommentAdded: (payload: { cardId: string; comment: Comment }) => void;
  applyCommentUpdated: (payload: { cardId: string; comment: Comment }) => void;
  applyCommentDeleted: (payload: { cardId: string; commentId: string }) => void;
};

function safeClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function clampIndex(value: number, max: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function normalizeFieldValues(values?: FieldValue[]): FieldValue[] {
  return (values ?? []).map((fieldValue) => ({
    ...fieldValue,
    valueText: fieldValue.valueText ?? null,
    valueNumber: fieldValue.valueNumber ?? null,
    valueDate: fieldValue.valueDate ?? null,
    users: fieldValue.users ?? [],
  }));
}

function normalizeChecklistItem(item: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: item.id ?? globalThis.crypto?.randomUUID?.() ?? `${item.checklistId}-${Date.now()}`,
    checklistId: item.checklistId ?? "",
    text: item.text ?? "",
    isDone: Boolean(item.isDone),
    order: item.order ?? 0,
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt,
  };
}

function normalizeChecklist(cardId: string, checklist: Partial<Checklist>): Checklist {
  const items = (checklist.items ?? []).map((item) => normalizeChecklistItem(item));
  items.sort((a, b) => a.order - b.order);
  return {
    id: checklist.id ?? globalThis.crypto?.randomUUID?.() ?? `${cardId}-${Date.now()}`,
    cardId,
    title: checklist.title ?? "",
    order: checklist.order ?? 0,
    items,
  };
}

function normalizeCommentAuthor(author: Partial<CommentAuthor> | null | undefined): CommentAuthor | null {
  if (!author || !author.id || !author.name) return null;
  return {
    id: author.id,
    name: author.name,
    email: author.email ?? null,
    avatarUrl: author.avatarUrl ?? null,
  };
}

function normalizeComment(comment: Partial<Comment>): Comment {
  return {
    id: comment.id ?? crypto.randomUUID?.() ?? `${comment.cardId}-${Date.now()}`,
    cardId: comment.cardId ?? "",
    authorId: comment.authorId ?? null,
    text: comment.text ?? "",
    createdAt: comment.createdAt ?? new Date().toISOString(),
    updatedAt: comment.updatedAt,
    author: normalizeCommentAuthor(comment.author ?? null),
  };
}

function normalizeComments(cardId: string, comments?: Array<Partial<Comment>>): Comment[] {
  const normalized = (comments ?? []).map((comment) => normalizeComment({ ...comment, cardId }));
  normalized.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return normalized;
}

function normalizeChecklists(cardId: string, checklists?: Array<Partial<Checklist>>): Checklist[] {
  const normalized = (checklists ?? []).map((checklist) => normalizeChecklist(cardId, checklist));
  normalized.sort((a, b) => a.order - b.order);
  return normalized;
}

function normalizeCard(card: Partial<Card>): Card {
  const normalized: Card = {
    id: card.id ?? "",
    boardId: card.boardId ?? "",
    columnId: card.columnId ?? "",
    title: card.title ?? "",
    description: card.description ?? null,
    order: card.order ?? 0,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    tags: card.tags ?? [],
    fieldValues: normalizeFieldValues(card.fieldValues),
    checklists: normalizeChecklists(card.id ?? "", card.checklists),
    comments: normalizeComments(card.id ?? "", card.comments),
  };

  return normalized;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  isLoading: false,
  error: null,
  boardId: null,
  title: null,
  ownerId: null,
  members: [],
  columnsOrder: [],
  columnsById: {},
  cardsById: {},
  fieldDefinitions: [],

  loadBoard: async (boardId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<BoardDetailsResponse>(`/boards/${boardId}`);
      get().setBoardFromApi(response.data);
      set({ isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to load board" });
    }
  },

  setBoardFromApi: (data) => {
    const columnsSorted = [...(data.columns ?? [])].sort((a, b) => a.order - b.order);
    const columnsById: Record<string, Column> = {};
    const cardsById: Record<string, Card> = {};
    const columnsOrder: string[] = [];

    for (const column of columnsSorted) {
      columnsOrder.push(column.id);
      const cardsSorted = [...(column.cards ?? [])].sort((a, b) => a.order - b.order);
      const cardIds: string[] = [];

      for (const card of cardsSorted) {
        const normalizedCard = normalizeCard(card);
        cardsById[card.id] = normalizedCard;
        cardIds.push(card.id);
      }

      columnsById[column.id] = {
        id: column.id,
        boardId: column.boardId,
        title: column.title,
        order: column.order,
        cardIds,
      };
    }

    set({
      boardId: data.id,
      title: data.title,
      ownerId: data.ownerId,
      members: data.members ?? [],
      columnsOrder,
      columnsById,
      cardsById,
      fieldDefinitions: data.fieldDefinitions ?? [],
      error: null,
    });
  },

  snapshot: () => {
    const state = get();
    return safeClone({
      boardId: state.boardId,
      title: state.title,
      columnsOrder: state.columnsOrder,
      columnsById: state.columnsById,
      cardsById: state.cardsById,
      fieldDefinitions: state.fieldDefinitions,
    });
  },

  restore: (snapshot) => {
    set({
      boardId: snapshot.boardId,
      title: snapshot.title,
      columnsOrder: snapshot.columnsOrder,
      columnsById: snapshot.columnsById,
      cardsById: snapshot.cardsById,
      fieldDefinitions: snapshot.fieldDefinitions,
      error: null,
    });
  },

  reorderColumns: (activeColumnId, overColumnId) => {
    if (activeColumnId === overColumnId) return;
    const state = get();
    const currentOrder = state.columnsOrder;
    const fromIndex = currentOrder.indexOf(activeColumnId);
    const toIndex = currentOrder.indexOf(overColumnId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...currentOrder];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, activeColumnId);

    const nextColumnsById = { ...state.columnsById };
    next.forEach((id, index) => {
      const existing = nextColumnsById[id];
      if (!existing) return;
      nextColumnsById[id] = { ...existing, order: index };
    });

    set({ columnsOrder: next, columnsById: nextColumnsById });
  },

  moveCardLocal: (cardId, toColumnId, toIndex) => {
    const state = get();
    const card = state.cardsById[cardId];
    const toColumn = state.columnsById[toColumnId];
    if (!card || !toColumn) return;

    const fromColumnId = card.columnId;
    const fromColumn = state.columnsById[fromColumnId];
    if (!fromColumn) return;

    const nextColumnsById: Record<string, Column> = { ...state.columnsById };
    const nextCardsById: Record<string, Card> = { ...state.cardsById };

    const fromIds = [...fromColumn.cardIds].filter((id) => id !== cardId);
    const toIds = fromColumnId === toColumnId ? fromIds : [...toColumn.cardIds].filter((id) => id !== cardId);

    const insertIndex = clampIndex(toIndex, toIds.length);
    toIds.splice(insertIndex, 0, cardId);

    nextColumnsById[fromColumnId] = { ...fromColumn, cardIds: fromIds };
    nextColumnsById[toColumnId] = { ...toColumn, cardIds: toIds };

    nextCardsById[cardId] = {
      ...card,
      columnId: toColumnId,
      order: insertIndex,
    };

    // Нормализуем order в обеих колонках, чтобы UI всегда совпадал с индексацией.
    for (const [columnId, ids] of [
      [fromColumnId, fromIds],
      [toColumnId, toIds],
    ] as const) {
      ids.forEach((id, index) => {
        const existing = nextCardsById[id];
        if (!existing) return;
        nextCardsById[id] = { ...existing, order: index, columnId };
      });
    }

    set({ columnsById: nextColumnsById, cardsById: nextCardsById });
  },

  applyColumnCreated: (column) => {
    const state = get();
    if (state.columnsById[column.id]) return;

    const nextColumnsById = {
      ...state.columnsById,
      [column.id]: {
        id: column.id,
        boardId: column.boardId,
        title: column.title,
        order: column.order,
        cardIds: [],
      },
    };

    const nextOrder = [...state.columnsOrder, column.id].sort((aId, bId) => {
      const a = nextColumnsById[aId]?.order ?? 0;
      const b = nextColumnsById[bId]?.order ?? 0;
      return a - b;
    });

    set({ columnsById: nextColumnsById, columnsOrder: nextOrder });
  },

  applyColumnUpdated: (column) => {
    const state = get();
    const existing = state.columnsById[column.id];
    if (!existing) return;

    set({
      columnsById: {
        ...state.columnsById,
        [column.id]: {
          ...existing,
          title: column.title ?? existing.title,
          order: column.order ?? existing.order,
        },
      },
    });
  },

  applyColumnDeleted: (payload) => {
    const state = get();
    const existing = state.columnsById[payload.id];
    if (!existing) return;

    const nextColumnsById = { ...state.columnsById };
    const nextCardsById = { ...state.cardsById };

    for (const cardId of existing.cardIds) {
      delete nextCardsById[cardId];
    }

    delete nextColumnsById[payload.id];
    const nextOrder = state.columnsOrder.filter((id) => id !== payload.id);

    set({ columnsById: nextColumnsById, cardsById: nextCardsById, columnsOrder: nextOrder });
  },

  applyColumnReordered: (payload) => {
    const state = get();
    const nextColumnsById = { ...state.columnsById };
    for (const column of payload.columns) {
      const existing = nextColumnsById[column.id];
      if (!existing) continue;
      nextColumnsById[column.id] = { ...existing, title: column.title, order: column.order };
    }
    const nextOrder = [...payload.columns]
      .sort((a, b) => a.order - b.order)
      .map((column) => column.id)
      .filter((id) => Boolean(nextColumnsById[id]));

    set({ columnsById: nextColumnsById, columnsOrder: nextOrder });
  },

  applyCardCreated: (card) => {
    const state = get();
    const column = state.columnsById[card.columnId];
    if (!column) return;

    const normalizedCard = normalizeCard(card);
    const nextCardsById = {
      ...state.cardsById,
      [card.id]: normalizedCard,
    };

    const ids = [...column.cardIds].filter((id) => id !== card.id);
    const insertIndex = clampIndex(card.order ?? ids.length, ids.length);
    ids.splice(insertIndex, 0, card.id);

    const nextColumnsById = {
      ...state.columnsById,
      [column.id]: { ...column, cardIds: ids },
    };

    ids.forEach((id, index) => {
      const existing = nextCardsById[id];
      if (!existing) return;
      nextCardsById[id] = { ...existing, order: index, columnId: column.id };
    });

    set({ columnsById: nextColumnsById, cardsById: nextCardsById });
  },

  applyCardUpdated: (card) => {
    const state = get();
    const existing = state.cardsById[card.id];
    if (!existing) return;

    set({
      cardsById: {
        ...state.cardsById,
        [card.id]: {
          ...existing,
          ...card,
          description: card.description ?? existing.description,
          tags: card.tags ?? existing.tags ?? [],
          fieldValues: card.fieldValues
            ? normalizeFieldValues(card.fieldValues)
            : existing.fieldValues,
          checklists: card.checklists
            ? normalizeChecklists(card.id ?? existing.id, card.checklists)
            : existing.checklists,
          comments: card.comments
            ? normalizeComments(card.id ?? existing.id, card.comments)
            : existing.comments,
        },
      },
    });
  },

  applyCardDeleted: (payload) => {
    const state = get();
    const existing = state.cardsById[payload.id];
    if (!existing) return;

    const columnId = payload.columnId ?? existing.columnId;
    const column = state.columnsById[columnId];

    const nextCardsById = { ...state.cardsById };
    delete nextCardsById[payload.id];

    if (!column) {
      set({ cardsById: nextCardsById });
      return;
    }

    const ids = column.cardIds.filter((id) => id !== payload.id);
    const nextColumnsById = {
      ...state.columnsById,
      [columnId]: { ...column, cardIds: ids },
    };

    ids.forEach((id, index) => {
      const card = nextCardsById[id];
      if (!card) return;
      nextCardsById[id] = { ...card, order: index, columnId };
    });

    set({ columnsById: nextColumnsById, cardsById: nextCardsById });
  },

  applyCardMoved: (card) => {
    const state = get();
    const existingCard = state.cardsById[card.id];
    if (!existingCard) {
      get().applyCardCreated(card);
      return;
    }

    const toColumn = state.columnsById[card.columnId];
    if (!toColumn) return;

    const fromColumn = state.columnsById[existingCard.columnId];
    if (!fromColumn) return;

    const nextCardsById = {
      ...state.cardsById,
      [card.id]: {
        ...existingCard,
        ...card,
        description: card.description ?? existingCard.description,
        tags: card.tags ?? existingCard.tags ?? [],
        fieldValues: card.fieldValues
          ? normalizeFieldValues(card.fieldValues)
          : existingCard.fieldValues,
        checklists: card.checklists
          ? normalizeChecklists(card.id ?? existingCard.id, card.checklists)
          : existingCard.checklists,
        comments: card.comments
          ? normalizeComments(card.id ?? existingCard.id, card.comments)
          : existingCard.comments,
      },
    };
    const nextColumnsById = { ...state.columnsById };

    const fromIds = fromColumn.cardIds.filter((id) => id !== card.id);
    const toIds = (existingCard.columnId === card.columnId
      ? fromIds
      : toColumn.cardIds.filter((id) => id !== card.id));

    const insertIndex = clampIndex(card.order ?? toIds.length, toIds.length);
    toIds.splice(insertIndex, 0, card.id);

    nextColumnsById[fromColumn.id] = { ...fromColumn, cardIds: fromIds };
    nextColumnsById[toColumn.id] = { ...toColumn, cardIds: toIds };

    for (const [columnId, ids] of [
      [fromColumn.id, fromIds],
      [toColumn.id, toIds],
    ] as const) {
      ids.forEach((id, index) => {
        const existing = nextCardsById[id];
        if (!existing) return;
        nextCardsById[id] = { ...existing, order: index, columnId };
      });
    }

    set({ columnsById: nextColumnsById, cardsById: nextCardsById });
  },

  applyFieldDefinitionCreated: (field) => {
    const state = get();
    const exists = state.fieldDefinitions.some((f) => f.id === field.id);
    if (exists) return;

    const next = [...state.fieldDefinitions, field].sort((a, b) => a.order - b.order);
    set({ fieldDefinitions: next });
  },

  applyFieldDefinitionUpdated: (field) => {
    const state = get();
    const next = state.fieldDefinitions
      .map((existing) => (existing.id === field.id ? field : existing))
      .sort((a, b) => a.order - b.order);
    set({ fieldDefinitions: next });
  },

  applyFieldDefinitionDeleted: (payload) => {
    const state = get();
    const deletedAt = payload.deletedAt ?? new Date().toISOString();
    const next = state.fieldDefinitions.map((field) => {
      if (field.id !== payload.fieldId) return field;
      return { ...field, deletedAt };
    });
    set({ fieldDefinitions: next });
  },

  applyCardFieldUpdated: (payload) => {
    const state = get();
    const card = state.cardsById[payload.cardId];
    if (!card) return;

    const currentFieldValues = card.fieldValues ?? [];
    const nextFieldValues = currentFieldValues.some((fv) => fv.fieldDefId === payload.fieldId)
      ? currentFieldValues.map((fv) =>
          fv.fieldDefId === payload.fieldId ? payload.fieldValue : fv,
        )
      : [...currentFieldValues, payload.fieldValue];

    set({
      cardsById: {
        ...state.cardsById,
        [payload.cardId]: {
          ...card,
          fieldValues: nextFieldValues,
        },
      },
    });
  },

  createChecklist: async (cardId, title) => {
    const response = await api.post<Checklist>(`/cards/${cardId}/checklists`, { title });
    get().applyChecklistCreated({
      cardId,
      checklist: normalizeChecklist(cardId, response.data),
    });
  },

  deleteChecklist: async (cardId, checklistId) => {
    await api.delete(`/checklists/${checklistId}`);
    get().applyChecklistDeleted({ cardId, checklistId });
  },

  addChecklistItem: async (cardId, checklistId, text) => {
    const response = await api.post<ChecklistItem>(`/checklists/${checklistId}/items`, { text });
    get().applyChecklistItemAdded({
      cardId,
      checklistId,
      item: normalizeChecklistItem(response.data),
    });
  },

  updateChecklistItem: async (cardId, checklistId, itemId, payload) => {
    const response = await api.patch<ChecklistItem>(`/checklist-items/${itemId}`, payload);
    get().applyChecklistItemUpdated({
      cardId,
      checklistId,
      item: normalizeChecklistItem(response.data),
    });
  },

  deleteChecklistItem: async (cardId, checklistId, itemId) => {
    await api.delete(`/checklist-items/${itemId}`);
    get().applyChecklistItemDeleted({ cardId, checklistId, itemId });
  },

  addComment: async (cardId, text) => {
    const response = await api.post<Comment>(`/cards/${cardId}/comments`, { text });
    get().applyCommentAdded({
      cardId,
      comment: normalizeComment(response.data),
    });
  },

  updateComment: async (cardId, commentId, text) => {
    const response = await api.patch<Comment>(`/comments/${commentId}`, { text });
    get().applyCommentUpdated({
      cardId,
      comment: normalizeComment(response.data),
    });
  },

  deleteComment: async (cardId, commentId) => {
    await api.delete(`/comments/${commentId}`);
    get().applyCommentDeleted({ cardId, commentId });
  },

  applyChecklistCreated: ({ cardId, checklist }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card) return;

    const nextChecklists = [...(card.checklists ?? [])];
    if (nextChecklists.some((entry) => entry.id === checklist.id)) return;
    nextChecklists.push(normalizeChecklist(cardId, checklist));
    nextChecklists.sort((a, b) => a.order - b.order);

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          checklists: nextChecklists,
        },
      },
    });
  },

  applyChecklistDeleted: ({ cardId, checklistId }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card || !card.checklists) return;

    const nextChecklists = card.checklists.filter((entry) => entry.id !== checklistId);

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          checklists: nextChecklists,
        },
      },
    });
  },

  applyChecklistItemAdded: ({ cardId, checklistId, item }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card || !card.checklists) return;

    const nextChecklists = card.checklists.map((checklist) => {
      if (checklist.id !== checklistId) return checklist;
      const nextItems = [...checklist.items];
      if (nextItems.some((entry) => entry.id === item.id)) return checklist;
      nextItems.push(normalizeChecklistItem(item));
      nextItems.sort((a, b) => a.order - b.order);
      return { ...checklist, items: nextItems };
    });

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          checklists: nextChecklists,
        },
      },
    });
  },

  applyChecklistItemUpdated: ({ cardId, checklistId, item }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card || !card.checklists) return;

    const nextChecklists = card.checklists.map((checklist) => {
      if (checklist.id !== checklistId) return checklist;
      const normalizedItem = normalizeChecklistItem(item);
      const nextItems = checklist.items
        .map((existing) => (existing.id === normalizedItem.id ? normalizedItem : existing))
        .sort((a, b) => a.order - b.order);
      return { ...checklist, items: nextItems };
    });

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          checklists: nextChecklists,
        },
      },
    });
  },

  applyChecklistItemDeleted: ({ cardId, checklistId, itemId }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card || !card.checklists) return;

    const nextChecklists = card.checklists.map((checklist) => {
      if (checklist.id !== checklistId) return checklist;
      return {
        ...checklist,
        items: checklist.items.filter((entry) => entry.id !== itemId),
      };
    });

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          checklists: nextChecklists,
        },
      },
    });
  },

  applyCommentAdded: ({ cardId, comment }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card) return;

    const nextComments = [...(card.comments ?? [])];
    if (nextComments.some((entry) => entry.id === comment.id)) return;
    nextComments.push(normalizeComment(comment));
    nextComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          comments: nextComments,
        },
      },
    });
  },

  applyCommentUpdated: ({ cardId, comment }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card || !card.comments) return;

    const normalized = normalizeComment(comment);
    const nextComments = card.comments
      .map((entry) => (entry.id === normalized.id ? normalized : entry))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          comments: nextComments,
        },
      },
    });
  },

  applyCommentDeleted: ({ cardId, commentId }) => {
    const state = get();
    const card = state.cardsById[cardId];
    if (!card || !card.comments) return;

    const nextComments = card.comments.filter((entry) => entry.id !== commentId);

    set({
      cardsById: {
        ...state.cardsById,
        [cardId]: {
          ...card,
          comments: nextComments,
        },
      },
    });
  },
}));
