import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardRole } from '../common/decorators/board-role.decorator';
import { BoardRoleGuard } from '../common/guards/board-role.guard';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { ChecklistsService } from './checklists.service';

@Controller()
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Post('cards/:cardId/checklists')
  @BoardRole(Role.EDITOR)
  createChecklist(@Param('cardId') cardId: string, @Body() dto: CreateChecklistDto) {
    return this.checklistsService.createChecklist(cardId, dto);
  }

  @Delete('checklists/:id')
  @BoardRole(Role.EDITOR)
  deleteChecklist(@Param('id') id: string) {
    return this.checklistsService.deleteChecklist(id);
  }

  @Post('checklists/:checklistId/items')
  @BoardRole(Role.EDITOR)
  addItem(@Param('checklistId') checklistId: string, @Body() dto: CreateChecklistItemDto) {
    return this.checklistsService.addItem(checklistId, dto);
  }

  @Patch('checklist-items/:itemId')
  @BoardRole(Role.EDITOR)
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateChecklistItemDto) {
    return this.checklistsService.updateItem(itemId, dto);
  }

  @Delete('checklist-items/:itemId')
  @BoardRole(Role.EDITOR)
  deleteItem(@Param('itemId') itemId: string) {
    return this.checklistsService.deleteItem(itemId);
  }
}
