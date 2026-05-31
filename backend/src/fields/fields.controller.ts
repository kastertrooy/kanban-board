import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardRole } from '../common/decorators/board-role.decorator';
import { BoardRoleGuard } from '../common/guards/board-role.guard';
import {
  CreateFieldDefinitionDto,
  UpdateFieldDefinitionDto,
} from './dto/field-definition.dto';
import { UpsertFieldValueDto } from './dto/field-value.dto';
import { FieldsService } from './fields.service';

@Controller()
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class FieldsController {
  constructor(private readonly fieldsService: FieldsService) {}

  @Post('boards/:boardId/fields')
  @BoardRole(Role.EDITOR)
  createFieldDefinition(
    @Param('boardId') boardId: string,
    @Body() dto: CreateFieldDefinitionDto,
  ) {
    return this.fieldsService.createFieldDefinition(boardId, dto);
  }

  @Patch('boards/:boardId/fields/:fieldId')
  @BoardRole(Role.EDITOR)
  updateFieldDefinition(
    @Param('boardId') boardId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldDefinitionDto,
  ) {
    return this.fieldsService.updateFieldDefinition(boardId, fieldId, dto);
  }

  @Delete('boards/:boardId/fields/:fieldId')
  @BoardRole(Role.EDITOR)
  deleteFieldDefinition(
    @Param('boardId') boardId: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.fieldsService.softDeleteFieldDefinition(boardId, fieldId);
  }

  @Post('cards/:cardId/fields/:fieldId')
  @BoardRole(Role.EDITOR)
  upsertFieldValue(
    @Param('cardId') cardId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpsertFieldValueDto,
  ) {
    return this.fieldsService.upsertFieldValue(cardId, fieldId, dto);
  }
}
