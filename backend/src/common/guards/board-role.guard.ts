import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { AuthenticatedRequest, AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { BOARD_ROLE_KEY } from '../decorators/board-role.decorator';

interface ResolvedBoardAccess {
  boardId: string;
  role: Role;
}

interface ColumnOrderPayload {
  id: string;
  order: number;
}

type BoardAwareRequest = AuthenticatedRequest &
  Request & {
    boardAccess?: ResolvedBoardAccess;
    params: Record<string, string | undefined>;
    body?: {
      boardId?: string;
      columnId?: string;
      cardId?: string;
      checklistId?: string;
      checklistItemId?: string;
      columns?: ColumnOrderPayload[];
    };
    originalUrl?: string;
    baseUrl?: string;
    route?: {
      path?: string;
    };
  };

@Injectable()
export class BoardRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<Role>(BOARD_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest<BoardAwareRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    const boardId = await this.resolveBoardId(request);

    if (!boardId) {
      throw new ForbiddenException('Board context is missing');
    }

    const access = await this.resolveBoardAccess(user, boardId);

    if (!access || !this.hasRequiredRole(access.role, requiredRole)) {
      throw new ForbiddenException('Insufficient board permissions');
    }

    request.boardAccess = access;
    return true;
  }

  private async resolveBoardId(request: BoardAwareRequest): Promise<string | null> {
    const directBoardId = request.params.boardId;

    if (directBoardId) {
      return directBoardId;
    }

    const explicitCardId = request.params.cardId;
    if (explicitCardId) {
      return this.findBoardIdByCardId(explicitCardId);
    }

    const explicitColumnId = request.params.columnId;
    if (explicitColumnId) {
      return this.findBoardIdByColumnId(explicitColumnId);
    }

    const explicitChecklistId = request.params.checklistId;
    if (explicitChecklistId) {
      return this.findBoardIdByChecklistId(explicitChecklistId);
    }

    const routeEntity = this.detectRouteEntity(request);
    const routeId = request.params.id;

    if (routeId && routeEntity === 'cards') {
      return this.findBoardIdByCardId(routeId);
    }

    if (routeId && routeEntity === 'columns') {
      return this.findBoardIdByColumnId(routeId);
    }

    if (routeId && routeEntity === 'checklists') {
      return this.findBoardIdByChecklistId(routeId);
    }

    if (routeId && routeEntity === 'checklist-items') {
      return this.findBoardIdByChecklistItemId(routeId);
    }

    if (routeId && routeEntity === 'boards') {
      return routeId;
    }

    const bodyBoardId = request.body?.boardId;
    if (bodyBoardId) {
      return bodyBoardId;
    }

    const bodyCardId = request.body?.cardId;
    if (bodyCardId) {
      return this.findBoardIdByCardId(bodyCardId);
    }

    const bodyColumnId = request.body?.columnId;
    if (bodyColumnId) {
      return this.findBoardIdByColumnId(bodyColumnId);
    }

    const bodyChecklistId = request.body?.checklistId;
    if (bodyChecklistId) {
      return this.findBoardIdByChecklistId(bodyChecklistId);
    }

    const bodyChecklistItemId = request.body?.checklistItemId;
    if (bodyChecklistItemId) {
      return this.findBoardIdByChecklistItemId(bodyChecklistItemId);
    }

    const reorderedColumns = request.body?.columns;
    if (reorderedColumns && reorderedColumns.length > 0) {
      return this.findBoardIdByColumnId(reorderedColumns[0].id);
    }

    return null;
  }

  private async resolveBoardAccess(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<ResolvedBoardAccess | null> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        members: {
          where: { userId: user.id },
          take: 1,
        },
      },
    });

    if (!board) {
      return null;
    }

    if (board.ownerId === user.id) {
      return {
        boardId,
        role: Role.OWNER,
      };
    }

    const membership = board.members[0];
    if (!membership) {
      return null;
    }

    return {
      boardId,
      role: membership.role,
    };
  }

  private hasRequiredRole(actualRole: Role, requiredRole: Role): boolean {
    const rolePriority: Record<Role, number> = {
      [Role.VIEWER]: 1,
      [Role.EDITOR]: 2,
      [Role.OWNER]: 3,
    };

    return rolePriority[actualRole] >= rolePriority[requiredRole];
  }

  private async findBoardIdByColumnId(columnId: string): Promise<string | null> {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    return column?.boardId ?? null;
  }

  private async findBoardIdByCardId(cardId: string): Promise<string | null> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { boardId: true },
    });

    return card?.boardId ?? null;
  }

  private async findBoardIdByChecklistId(checklistId: string): Promise<string | null> {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      select: {
        card: {
          select: {
            boardId: true,
          },
        },
      },
    });

    return checklist?.card?.boardId ?? null;
  }

  private async findBoardIdByChecklistItemId(itemId: string): Promise<string | null> {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: {
        checklist: {
          select: {
            card: {
              select: {
                boardId: true,
              },
            },
          },
        },
      },
    });

    return item?.checklist?.card?.boardId ?? null;
  }

  private detectRouteEntity(
    request: BoardAwareRequest,
  ): 'boards' | 'columns' | 'cards' | 'checklists' | 'checklist-items' | null {
    const routePath = `${request.baseUrl ?? ''}${request.route?.path ?? ''}${request.originalUrl ?? ''}`;

    if (routePath.includes('/boards')) {
      return 'boards';
    }

    if (routePath.includes('/columns')) {
      return 'columns';
    }

    if (routePath.includes('/checklist-items')) {
      return 'checklist-items';
    }

    if (routePath.includes('/cards')) {
      return 'cards';
    }

    if (routePath.includes('/checklists')) {
      return 'checklists';
    }

    return null;
  }
}
