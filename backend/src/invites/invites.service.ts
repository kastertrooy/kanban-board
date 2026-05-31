import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InviteLink, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createInvite(
    boardId: string,
    createdById: string,
    dto: CreateInviteDto,
  ): Promise<InviteLink & { inviteUrl: string }> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (dto.role === Role.OWNER) {
      throw new BadRequestException('Invite role OWNER is not supported');
    }

    const invite = await this.prisma.inviteLink.create({
      data: {
        boardId,
        createdById,
        role: dto.role,
        token: randomUUID(),
      },
    });

    return {
      ...invite,
      inviteUrl: `${this.getFrontendUrl()}/invites/${invite.token}`,
    };
  }

  async getInviteInfo(token: string) {
    const invite = await this.prisma.inviteLink.findUnique({
      where: { token },
      include: {
        board: {
          select: {
            id: true,
            title: true,
            owner: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!invite || invite.isRevoked) {
      throw new NotFoundException('Invite not found');
    }

    return {
      token: invite.token,
      role: invite.role,
      board: invite.board,
      createdAt: invite.createdAt,
      isRevoked: invite.isRevoked,
    };
  }

  private getFrontendUrl(): string {
    return this.configService.get<string>('frontendUrl')
      ?? this.configService.get<string>('FRONTEND_URL')
      ?? 'http://localhost:3000';
  }
}
