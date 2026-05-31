import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardRole } from '../common/decorators/board-role.decorator';
import { BoardRoleGuard } from '../common/guards/board-role.guard';
import { CardService } from './card.service';
import { CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/card.dto';

@Controller('cards')
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class CardsController {
  constructor(private readonly cardService: CardService) {}

  @Post()
  @BoardRole(Role.EDITOR)
  createCard(@Body() dto: CreateCardDto) {
    return this.cardService.createCard(dto);
  }

  @Patch(':id/move')
  @BoardRole(Role.EDITOR)
  moveCard(@Param('id') cardId: string, @Body() dto: MoveCardDto) {
    return this.cardService.moveCard(cardId, dto);
  }

  @Patch(':id')
  @BoardRole(Role.EDITOR)
  updateCard(@Param('id') cardId: string, @Body() dto: UpdateCardDto) {
    return this.cardService.updateCard(cardId, dto);
  }

  @Delete(':id')
  @BoardRole(Role.EDITOR)
  deleteCard(@Param('id') cardId: string) {
    return this.cardService.deleteCard(cardId);
  }
}
