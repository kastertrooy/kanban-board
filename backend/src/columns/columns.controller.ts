import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardRole } from '../common/decorators/board-role.decorator';
import { BoardRoleGuard } from '../common/guards/board-role.guard';
import { ColumnsService } from './columns.service';
import { CreateColumnDto, ReorderColumnsDto, UpdateColumnDto } from './dto/column.dto';

@Controller('columns')
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Post()
  @BoardRole(Role.EDITOR)
  createColumn(@Body() dto: CreateColumnDto) {
    return this.columnsService.createColumn(dto);
  }

  @Patch('reorder')
  @BoardRole(Role.EDITOR)
  reorderColumns(@Body() dto: ReorderColumnsDto) {
    return this.columnsService.reorderColumns(dto);
  }

  @Patch(':id')
  @BoardRole(Role.EDITOR)
  updateColumn(@Param('id') columnId: string, @Body() dto: UpdateColumnDto) {
    return this.columnsService.updateColumn(columnId, dto);
  }

  @Delete(':id')
  @BoardRole(Role.EDITOR)
  deleteColumn(@Param('id') columnId: string) {
    return this.columnsService.deleteColumn(columnId);
  }
}
