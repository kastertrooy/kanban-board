import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

import { verifyJwtToken, AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

interface BoardRoomPayload {
  boardId: string;
}

interface SocketAuthShape {
  token?: string;
}

type AuthenticatedSocket = Socket & {
  data: Socket['data'] & {
    user: AuthenticatedUser;
  };
};

@Injectable()
@WebSocketGateway({ cors: true })
export class BoardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractHandshakeToken(client);
      const secret = this.configService.get<string>('jwtSecret')
        ?? this.configService.get<string>('JWT_SECRET');

      if (!secret) {
        throw new UnauthorizedException('JWT secret is not configured');
      }

      const payload = verifyJwtToken(token, secret);
      client.data.user = payload;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    client.removeAllListeners();
  }

  @SubscribeMessage('join_board')
  async handleJoinBoard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: BoardRoomPayload,
  ): Promise<void> {
    try {
      this.validateBoardPayload(payload);

      const hasAccess = await this.userHasBoardAccess(client.data.user.sub, payload.boardId);

      if (!hasAccess) {
        throw new WsException('Access denied to this board');
      }

      await client.join(this.getBoardRoom(payload.boardId));
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException('Failed to join board');
    }
  }

  @SubscribeMessage('leave_board')
  async handleLeaveBoard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: BoardRoomPayload,
  ): Promise<void> {
    try {
      this.validateBoardPayload(payload);
      await client.leave(this.getBoardRoom(payload.boardId));
    } catch {
      throw new WsException('Failed to leave board');
    }
  }

  public notifyBoard(boardId: string, event: string, data: unknown): void {
    this.server.to(this.getBoardRoom(boardId)).emit(event, data);
  }

  private extractHandshakeToken(client: Socket): string {
    const auth = client.handshake.auth as SocketAuthShape | undefined;

    if (!auth?.token || !auth.token.trim()) {
      throw new UnauthorizedException('Socket token is missing');
    }

    return auth.token;
  }

  private validateBoardPayload(payload: BoardRoomPayload): void {
    if (!payload.boardId || !payload.boardId.trim()) {
      throw new WsException('boardId is required');
    }
  }

  private async userHasBoardAccess(userId: string, boardId: string): Promise<boolean> {
    const board = await this.prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return Boolean(board);
  }

  private getBoardRoom(boardId: string): string {
    return `board:${boardId}`;
  }
}
