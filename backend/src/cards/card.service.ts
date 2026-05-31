import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Card } from '@prisma/client';

import { BoardGateway } from '../boards/board.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/card.dto';

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
  ) {}

  async createCard(dto: CreateCardDto): Promise<Card> {
    const column = await this.prisma.column.findUnique({
      where: { id: dto.columnId },
      select: { boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    if (column.boardId !== dto.boardId) {
      throw new BadRequestException('Column does not belong to the specified board');
    }

    const lastCard = await this.prisma.card.findFirst({
      where: {
        boardId: dto.boardId,
        columnId: dto.columnId,
      },
      orderBy: {
        order: 'desc',
      },
      select: {
        order: true,
      },
    });

    const card = await this.prisma.card.create({
      data: {
        boardId: dto.boardId,
        columnId: dto.columnId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        order: (lastCard?.order ?? -1) + 1,
      },
    });

    this.boardGateway.notifyBoard(dto.boardId, 'card_created', card);

    return card;
  }

  async moveCard(cardId: string, dto: MoveCardDto): Promise<Card> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const targetColumn = await this.prisma.column.findUnique({
      where: { id: dto.columnId },
      select: { id: true, boardId: true },
    });

    if (!targetColumn) {
      throw new NotFoundException('Target column not found');
    }

    if (targetColumn.boardId !== card.boardId) {
      throw new BadRequestException('Cannot move card to a column in another board');
    }

    const movedCard = await this.prisma.$transaction(async (tx) => {
      if (card.columnId === dto.columnId) {
        const siblings = await tx.card.findMany({
          where: {
            columnId: card.columnId,
          },
          orderBy: {
            order: 'asc',
          },
        });

        const nextOrder = this.buildReorderedCards(siblings, card.id, dto.order);

        await Promise.all(
          nextOrder.map((item, index) =>
            tx.card.update({
              where: { id: item.id },
              data: { order: index },
            }),
          ),
        );

        return tx.card.findUniqueOrThrow({
          where: { id: card.id },
        });
      }

      const sourceCards = await tx.card.findMany({
        where: {
          columnId: card.columnId,
          id: { not: card.id },
        },
        orderBy: {
          order: 'asc',
        },
      });

      const targetCards = await tx.card.findMany({
        where: {
          columnId: dto.columnId,
          id: { not: card.id },
        },
        orderBy: {
          order: 'asc',
        },
      });

      const targetOrder = this.clampOrder(dto.order, targetCards.length);
      const targetSequence = [...targetCards];
      targetSequence.splice(targetOrder, 0, card);

      await Promise.all(
        sourceCards.map((item, index) =>
          tx.card.update({
            where: { id: item.id },
            data: { order: index },
          }),
        ),
      );

      await Promise.all(
        targetSequence.map((item, index) =>
          tx.card.update({
            where: { id: item.id },
            data: {
              columnId: dto.columnId,
              boardId: targetColumn.boardId,
              order: index,
            },
          }),
        ),
      );

      return tx.card.findUniqueOrThrow({
        where: { id: card.id },
      });
    });

    this.boardGateway.notifyBoard(card.boardId, 'card_moved', movedCard);

    return movedCard;
  }

  async updateCard(cardId: string, dto: UpdateCardDto): Promise<Card> {
    const existingCard = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { boardId: true },
    });

    if (!existingCard) {
      throw new NotFoundException('Card not found');
    }

    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
      },
    });

    this.boardGateway.notifyBoard(existingCard.boardId, 'card_updated', card);

    return card;
  }

  async deleteCard(cardId: string): Promise<{ success: true }> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        boardId: true,
        columnId: true,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.card.delete({
        where: { id: cardId },
      });

      const remainingCards = await tx.card.findMany({
        where: { columnId: card.columnId },
        orderBy: { order: 'asc' },
      });

      await Promise.all(
        remainingCards.map((item, index) =>
          tx.card.update({
            where: { id: item.id },
            data: { order: index },
          }),
        ),
      );
    });

    this.boardGateway.notifyBoard(card.boardId, 'card_deleted', {
      id: card.id,
      boardId: card.boardId,
      columnId: card.columnId,
    });

    return { success: true };
  }

  private buildReorderedCards(cards: Card[], cardId: string, requestedOrder: number): Card[] {
    const nextCards = cards.filter((item) => item.id !== cardId);
    const movingCard = cards.find((item) => item.id === cardId);

    if (!movingCard) {
      throw new NotFoundException('Card not found');
    }

    const nextOrder = this.clampOrder(requestedOrder, nextCards.length);
    nextCards.splice(nextOrder, 0, movingCard);

    return nextCards;
  }

  private clampOrder(order: number, maxIndex: number): number {
    if (order < 0) {
      return 0;
    }

    if (order > maxIndex) {
      return maxIndex;
    }

    return order;
  }
}
