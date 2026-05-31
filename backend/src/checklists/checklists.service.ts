import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BoardGateway } from '../boards/board.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
  ) {}

  async createChecklist(cardId: string, dto: CreateChecklistDto) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        boardId: true,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const checklist = await this.prisma.checklist.create({
      data: {
        cardId,
        title: dto.title.trim(),
      },
    });

    this.boardGateway.notifyBoard(card.boardId, 'checklist_created', {
      cardId,
      checklist,
    });

    return checklist;
  }

  async deleteChecklist(checklistId: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      select: {
        cardId: true,
        card: { select: { boardId: true } },
      },
    });

    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    await this.prisma.checklist.delete({ where: { id: checklistId } });

    this.boardGateway.notifyBoard(checklist.card.boardId, 'checklist_deleted', {
      cardId: checklist.cardId,
      checklistId,
    });

    return { success: true };
  }

  async addItem(checklistId: string, dto: CreateChecklistItemDto) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      select: {
        cardId: true,
        card: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const siblings = await tx.checklistItem.findMany({
        where: { checklistId },
        orderBy: { order: 'asc' },
      });

      const insertIndex = this.clampOrder(dto.order ?? siblings.length, siblings.length);

      const created = await tx.checklistItem.create({
        data: {
          checklistId,
          text: dto.text.trim(),
          isDone: false,
          order: insertIndex,
        },
      });

      const sequence = siblings.map((entry) => ({ id: entry.id }));
      sequence.splice(insertIndex, 0, { id: created.id });

      await this.reorderChecklistItems(tx, sequence);

      return tx.checklistItem.findUniqueOrThrow({ where: { id: created.id } });
    });

    this.boardGateway.notifyBoard(checklist.card.boardId, 'checklist_item_added', {
      cardId: checklist.cardId,
      checklistId,
      item,
    });

    return item;
  }

  async updateItem(itemId: string, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: {
        checklist: {
          select: {
            cardId: true,
            card: {
              select: {
                boardId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatePayload: Prisma.ChecklistItemUpdateInput = {};

      if (dto.text !== undefined) {
        updatePayload.text = dto.text.trim();
      }

      if (dto.isDone !== undefined) {
        updatePayload.isDone = dto.isDone;
      }

      if (Object.keys(updatePayload).length > 0) {
        await tx.checklistItem.update({ where: { id: itemId }, data: updatePayload });
      }

      if (dto.order !== undefined) {
        const sequence = await tx.checklistItem.findMany({
          where: { checklistId: item.checklistId },
          orderBy: { order: 'asc' },
        });

        const normalizedIndex = this.clampOrder(dto.order, sequence.length - 1);
        const reordered = sequence
          .filter((entry) => entry.id !== itemId)
          .map((entry) => ({ id: entry.id }));
        reordered.splice(normalizedIndex, 0, { id: itemId });

        await this.reorderChecklistItems(tx, reordered);
      }

      return tx.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
    });

    this.boardGateway.notifyBoard(item.checklist.card.boardId, 'checklist_item_updated', {
      cardId: item.checklist.cardId,
      checklistId: item.checklistId,
      item: updated,
    });

    return updated;
  }

  async deleteItem(itemId: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: {
        checklist: {
          select: {
            cardId: true,
            card: {
              select: {
                boardId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.checklistItem.delete({ where: { id: itemId } });

      const remaining = await tx.checklistItem.findMany({
        where: { checklistId: item.checklistId },
        orderBy: { order: 'asc' },
      });

      await this.reorderChecklistItems(
        tx,
        remaining.map((entry) => ({ id: entry.id })),
      );
    });

    this.boardGateway.notifyBoard(item.checklist.card.boardId, 'checklist_item_deleted', {
      cardId: item.checklist.cardId,
      checklistId: item.checklistId,
      itemId,
    });

    return { success: true };
  }

  private clampOrder(value: number, max: number): number {
    if (Number.isNaN(value)) {
      return 0;
    }

    if (value < 0) {
      return 0;
    }

    if (value > max) {
      return max;
    }

    return value;
  }

  private async reorderChecklistItems(
    tx: Prisma.TransactionClient,
    sequence: Array<{ id: string }>,
  ): Promise<void> {
    await Promise.all(
      sequence.map((entry, index) =>
        tx.checklistItem.update({
          where: { id: entry.id },
          data: { order: index },
        }),
      ),
    );
  }
}
