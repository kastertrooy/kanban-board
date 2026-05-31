"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { BoardView } from "@/components/board/BoardView";
import { FieldSettingsModal } from "@/components/board/FieldSettingsModal";
import { MembersModal } from "@/components/board/MembersModal";
import { useSocketStore } from "@/store/socketStore";
import {
  useBoardStore,
  type Card,
  type Checklist,
  type ChecklistItem,
  type Comment,
  type FieldDefinition,
  type FieldValue,
} from "@/store/boardStore";
import { useAuthStore } from "@/store/authStore";

const SOCKET_EVENTS = [
  "card_created",
  "card_updated",
  "card_moved",
  "card_deleted",
  "column_created",
  "column_updated",
  "column_reordered",
  "column_deleted",
  "field_definition_created",
  "field_definition_updated",
  "field_definition_deleted",
  "card_field_updated",
  "checklist_created",
  "checklist_deleted",
  "checklist_item_added",
  "checklist_item_updated",
  "checklist_item_deleted",
  "comment_added",
  "comment_updated",
  "comment_deleted",
] as const;

type SocketEvent = (typeof SOCKET_EVENTS)[number];

type ColumnCreatedPayload = { id: string; boardId: string; title: string; order: number };
type ColumnUpdatedPayload = { id: string; title?: string; order?: number };
type ColumnDeletedPayload = { id: string };
type ColumnReorderedPayload = { columns: Array<{ id: string; order: number; title: string; boardId: string }> };
type CardDeletedPayload = { id: string; columnId?: string };
type FieldDefinitionDeletedPayload = { boardId: string; fieldId: string; deletedAt: string };
type CardFieldUpdatedPayload = { boardId: string; cardId: string; fieldId: string; fieldValue: FieldValue };
type ChecklistCreatedPayload = { cardId: string; checklist: Checklist };
type ChecklistDeletedPayload = { cardId: string; checklistId: string };
type ChecklistItemPayload = { cardId: string; checklistId: string; item: ChecklistItem };
type ChecklistItemDeletedPayload = { cardId: string; checklistId: string; itemId: string };
type CommentPayload = { cardId: string; comment: Comment };
type CommentDeletedPayload = { cardId: string; commentId: string };

export default function BoardPlaceholderPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;
  const connectSocket = useSocketStore((state) => state.connect);
  const loadBoard = useBoardStore((state) => state.loadBoard);
  const applyCardCreated = useBoardStore((state) => state.applyCardCreated);
  const applyCardUpdated = useBoardStore((state) => state.applyCardUpdated);
  const applyCardMoved = useBoardStore((state) => state.applyCardMoved);
  const applyCardDeleted = useBoardStore((state) => state.applyCardDeleted);
  const applyColumnCreated = useBoardStore((state) => state.applyColumnCreated);
  const applyColumnUpdated = useBoardStore((state) => state.applyColumnUpdated);
  const applyColumnReordered = useBoardStore((state) => state.applyColumnReordered);
  const applyColumnDeleted = useBoardStore((state) => state.applyColumnDeleted);
  const applyFieldDefinitionCreated = useBoardStore((state) => state.applyFieldDefinitionCreated);
  const applyFieldDefinitionUpdated = useBoardStore((state) => state.applyFieldDefinitionUpdated);
  const applyFieldDefinitionDeleted = useBoardStore((state) => state.applyFieldDefinitionDeleted);
  const applyCardFieldUpdated = useBoardStore((state) => state.applyCardFieldUpdated);
  const applyChecklistCreated = useBoardStore((state) => state.applyChecklistCreated);
  const applyChecklistDeleted = useBoardStore((state) => state.applyChecklistDeleted);
  const applyChecklistItemAdded = useBoardStore((state) => state.applyChecklistItemAdded);
  const applyChecklistItemUpdated = useBoardStore((state) => state.applyChecklistItemUpdated);
  const applyChecklistItemDeleted = useBoardStore((state) => state.applyChecklistItemDeleted);
  const applyCommentAdded = useBoardStore((state) => state.applyCommentAdded);
  const applyCommentUpdated = useBoardStore((state) => state.applyCommentUpdated);
  const applyCommentDeleted = useBoardStore((state) => state.applyCommentDeleted);

  const ownerId = useBoardStore((state) => state.ownerId);
  const members = useBoardStore((state) => state.members);
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const [isFieldSettingsOpen, setIsFieldSettingsOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const handlers = useMemo(() => {
    const record: Record<SocketEvent, (payload: unknown) => void> = {
      card_created: (payload) => applyCardCreated(payload as Card),
      card_updated: (payload) => applyCardUpdated(payload as Card),
      card_moved: (payload) => applyCardMoved(payload as Card),
      card_deleted: (payload) => applyCardDeleted(payload as CardDeletedPayload),
      column_created: (payload) => applyColumnCreated(payload as ColumnCreatedPayload),
      column_updated: (payload) => applyColumnUpdated(payload as ColumnUpdatedPayload),
      column_reordered: (payload) => applyColumnReordered(payload as ColumnReorderedPayload),
      column_deleted: (payload) => applyColumnDeleted(payload as ColumnDeletedPayload),
      field_definition_created: (payload) => applyFieldDefinitionCreated(payload as FieldDefinition),
      field_definition_updated: (payload) => applyFieldDefinitionUpdated(payload as FieldDefinition),
      field_definition_deleted: (payload) => {
        const data = payload as FieldDefinitionDeletedPayload & { id?: string; fieldId?: string };
        const fieldId = data.fieldId ?? data.id;
        if (!fieldId) return;
        applyFieldDefinitionDeleted({ fieldId, deletedAt: data.deletedAt });
      },
      card_field_updated: (payload) => {
        const data = payload as CardFieldUpdatedPayload;
        applyCardFieldUpdated({
          cardId: data.cardId,
          fieldId: data.fieldId,
          fieldValue: data.fieldValue,
        });
      },
      checklist_created: (payload) => {
        const data = payload as ChecklistCreatedPayload;
        applyChecklistCreated(data);
      },
      checklist_deleted: (payload) => {
        const data = payload as ChecklistDeletedPayload;
        applyChecklistDeleted(data);
      },
      checklist_item_added: (payload) => {
        const data = payload as ChecklistItemPayload;
        applyChecklistItemAdded(data);
      },
      checklist_item_updated: (payload) => {
        const data = payload as ChecklistItemPayload;
        applyChecklistItemUpdated(data);
      },
      checklist_item_deleted: (payload) => {
        const data = payload as ChecklistItemDeletedPayload;
        applyChecklistItemDeleted(data);
      },
      comment_added: (payload) => {
        const data = payload as CommentPayload;
        applyCommentAdded(data);
      },
      comment_updated: (payload) => {
        const data = payload as CommentPayload;
        applyCommentUpdated(data);
      },
      comment_deleted: (payload) => {
        const data = payload as CommentDeletedPayload;
        applyCommentDeleted({ cardId: data.cardId, commentId: data.commentId });
      },
    };

    return record;
  }, [
    applyCardCreated,
    applyCardDeleted,
    applyCardMoved,
    applyCardUpdated,
    applyColumnCreated,
    applyColumnDeleted,
    applyColumnReordered,
    applyColumnUpdated,
    applyFieldDefinitionCreated,
    applyFieldDefinitionDeleted,
    applyFieldDefinitionUpdated,
    applyCardFieldUpdated,
    applyChecklistCreated,
    applyChecklistDeleted,
    applyChecklistItemAdded,
    applyChecklistItemUpdated,
    applyChecklistItemDeleted,
    applyCommentAdded,
    applyCommentUpdated,
    applyCommentDeleted,
  ]);

  useEffect(() => {
    void loadBoard(boardId);
  }, [boardId, loadBoard]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) {
      return;
    }

    const join = () => socket.emit("join_board", { boardId });
    if (socket.connected) {
      join();
    } else {
      socket.once("connect", join);
    }

    for (const event of SOCKET_EVENTS) {
      socket.on(event, handlers[event]);
    }

    return () => {
      try {
        socket.emit("leave_board", { boardId });
      } finally {
        socket.off("connect", join);
        for (const event of SOCKET_EVENTS) {
          socket.off(event, handlers[event]);
        }
      }
    };
  }, [boardId, connectSocket, handlers]);

  const canManageFields = useMemo(() => {
    if (!authUserId) return false;
    if (ownerId && authUserId === ownerId) return true;
    const membership = members.find((member) => member.user.id === authUserId);
    return membership?.role === "OWNER" || membership?.role === "EDITOR";
  }, [authUserId, members, ownerId]);

  const isOwner = Boolean(ownerId && authUserId && authUserId === ownerId);

  return (
    <>
      <BoardView
        boardId={boardId}
        canManageFields={canManageFields}
        canManageMembers={isOwner}
        onOpenMembers={() => setIsMembersOpen(true)}
        onOpenFieldSettings={() => setIsFieldSettingsOpen(true)}
      />
      <FieldSettingsModal
        boardId={boardId}
        isOpen={isFieldSettingsOpen}
        onClose={() => setIsFieldSettingsOpen(false)}
        canManageFields={canManageFields}
      />
      <MembersModal
        boardId={boardId}
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        members={members}
      />
    </>
  );
}
