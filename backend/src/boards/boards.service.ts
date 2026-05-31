import { Injectable, NotFoundException } from '@nestjs/common';
import { Board, Role } from '@prisma/client';

import { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { BoardGateway } from './board.gateway';
import { CreateBoardDto, UpdateBoardDto } from './dto/board.dto';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
  ) {}

  async createBoard(user: AuthenticatedUser, dto: CreateBoardDto): Promise<Board> {
    const board = await this.prisma.$transaction(async (tx) => {
      const createdBoard = await tx.board.create({
        data: {
          title: dto.title.trim(),
          ownerId: user.id,
        },
      });

      await tx.boardMember.create({
        data: {
          boardId: createdBoard.id,
          userId: user.id,
          role: Role.OWNER,
        },
      });

      return createdBoard;
    });

    this.boardGateway.notifyBoard(board.id, 'board_created', board);

    return board;
  }

  async getUserBoards(userId: string) {
    return this.prisma.board.findMany({
      where: {
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
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getBoardById(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
        columns: {
          orderBy: {
            order: 'asc',
          },
          include: {
            cards: {
              orderBy: {
                order: 'asc',
              },
              include: {
                fieldValues: {
                  include: {
                    users: {
                      include: {
                        user: {
                          select: {
                            id: true,
                            email: true,
                            name: true,
                            avatarUrl: true,
                          },
                        },
                      },
                    },
                  },
                },
                tags: {
                  include: {
                    tag: true,
                  },
                },
                checklists: {
                  include: {
                    items: {
                      orderBy: {
                        order: 'asc',
                      },
                    },
                  },
                },
                comments: {
                  orderBy: {
                    createdAt: 'asc',
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
                },
              },
            },
          },
        },
        cards: {
          orderBy: [
            { columnId: 'asc' },
            { order: 'asc' },
          ],
          include: {
            fieldValues: {
              include: {
                users: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        name: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            checklists: {
              include: {
                items: {
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
            },
            comments: {
              orderBy: {
                createdAt: 'asc',
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
            },
          },
        },
        fieldDefinitions: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            order: 'asc',
          },
        },
        tags: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    return board;
  }

  async updateBoard(boardId: string, dto: UpdateBoardDto) {
    await this.ensureBoardExists(boardId);

    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        title: dto.title?.trim(),
      },
    });

    this.boardGateway.notifyBoard(boardId, 'board_updated', board);

    return board;
  }

  async deleteBoard(boardId: string): Promise<{ success: true }> {
    await this.ensureBoardExists(boardId);

    await this.prisma.board.delete({
      where: { id: boardId },
    });

    this.boardGateway.notifyBoard(boardId, 'board_deleted', { boardId });

    return { success: true };
  }

  private async ensureBoardExists(boardId: string): Promise<void> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }
  }
}
