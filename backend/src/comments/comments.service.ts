import { Injectable, NotFoundException } from '@nestjs/common';
import { Comment } from '@prisma/client';

import { BoardGateway } from '../boards/board.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createComment(cardId: string, authorId: string, dto: CreateCommentDto) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        title: true,
        boardId: true,
        board: {
          select: {
            ownerId: true,
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const trimmedText = dto.text.trim();

    const comment = await this.prisma.comment.create({
      data: {
        cardId,
        authorId,
        text: trimmedText,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { name: true, email: true },
    });

    const recipients = new Set<string>();
    if (card.board.ownerId) {
      recipients.add(card.board.ownerId);
    }
    for (const member of card.board.members) {
      recipients.add(member.userId);
    }
    recipients.delete(authorId);

    const authorName = author?.name ?? author?.email ?? 'Unknown user';
    await Promise.allSettled(
      Array.from(recipients).map((userId) =>
        this.notificationsService.notifyComment(userId, card.title, authorName),
      ),
    );

    this.boardGateway.notifyBoard(card.boardId, 'comment_added', {
      cardId,
      comment,
    });

    return comment;
  }

  async updateComment(commentId: string, text: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        cardId: true,
        card: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { text: text.trim() },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    this.boardGateway.notifyBoard(existing.card.boardId, 'comment_updated', {
      cardId: updated.cardId,
      comment: updated,
    });

    return updated;
  }

  async deleteComment(commentId: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        cardId: true,
        card: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    this.boardGateway.notifyBoard(existing.card.boardId, 'comment_deleted', {
      cardId: existing.cardId,
      commentId,
    });

    return { success: true };
  }
}
