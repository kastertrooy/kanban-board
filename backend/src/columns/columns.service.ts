import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Column } from '@prisma/client';

import { BoardGateway } from '../boards/board.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CreateColumnDto, ReorderColumnsDto, UpdateColumnDto } from './dto/column.dto';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
  ) {}

  async createColumn(dto: CreateColumnDto): Promise<Column> {
    await this.ensureBoardExists(dto.boardId);

    const lastColumn = await this.prisma.column.findFirst({
      where: { boardId: dto.boardId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const column = await this.prisma.column.create({
      data: {
        boardId: dto.boardId,
        title: dto.title.trim(),
        order: (lastColumn?.order ?? -1) + 1,
      },
    });

    this.boardGateway.notifyBoard(dto.boardId, 'column_created', column);

    return column;
  }

  async reorderColumns(dto: ReorderColumnsDto) {
    const columns = await this.prisma.column.findMany({
      where: {
        id: {
          in: dto.columns.map((column) => column.id),
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (columns.length !== dto.columns.length) {
      throw new NotFoundException('One or more columns were not found');
    }

    const boardIds = new Set(columns.map((column) => column.boardId));
    if (boardIds.size !== 1) {
      throw new BadRequestException('Columns must belong to the same board');
    }

    const boardId = columns[0].boardId;

    await this.prisma.$transaction(
      dto.columns.map((column) =>
        this.prisma.column.update({
          where: { id: column.id },
          data: { order: column.order },
        }),
      ),
    );

    const reorderedColumns = await this.prisma.column.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
    });

    this.boardGateway.notifyBoard(boardId, 'column_reordered', {
      boardId,
      columns: reorderedColumns,
    });

    return reorderedColumns;
  }

  async updateColumn(columnId: string, dto: UpdateColumnDto): Promise<Column> {
    const existingColumn = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    if (!existingColumn) {
      throw new NotFoundException('Column not found');
    }

    const column = await this.prisma.column.update({
      where: { id: columnId },
      data: {
        title: dto.title?.trim(),
      },
    });

    this.boardGateway.notifyBoard(existingColumn.boardId, 'column_updated', column);

    return column;
  }

  async deleteColumn(columnId: string): Promise<{ success: true }> {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.column.delete({
        where: { id: columnId },
      });

      const remainingColumns = await tx.column.findMany({
        where: { boardId: column.boardId },
        orderBy: { order: 'asc' },
      });

      await Promise.all(
        remainingColumns.map((item, index) =>
          tx.column.update({
            where: { id: item.id },
            data: { order: index },
          }),
        ),
      );
    });

    this.boardGateway.notifyBoard(column.boardId, 'column_deleted', {
      id: column.id,
      boardId: column.boardId,
    });

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
