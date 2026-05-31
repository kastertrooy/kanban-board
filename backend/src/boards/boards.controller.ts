import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardRole } from '../common/decorators/board-role.decorator';
import { BoardRoleGuard } from '../common/guards/board-role.guard';
import { BoardsService } from './boards.service';
import { CreateBoardDto, UpdateBoardDto } from './dto/board.dto';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  createBoard(@Req() req: AuthenticatedRequest, @Body() dto: CreateBoardDto) {
    return this.boardsService.createBoard(req.user!, dto);
  }

  @Get()
  getBoards(@Req() req: AuthenticatedRequest) {
    return this.boardsService.getUserBoards(req.user!.id);
  }

  @Get(':boardId')
  @BoardRole(Role.VIEWER)
  @UseGuards(BoardRoleGuard)
  getBoard(@Param('boardId') boardId: string) {
    return this.boardsService.getBoardById(boardId);
  }

  @Patch(':boardId')
  @BoardRole(Role.OWNER)
  @UseGuards(BoardRoleGuard)
  updateBoard(@Param('boardId') boardId: string, @Body() dto: UpdateBoardDto) {
    return this.boardsService.updateBoard(boardId, dto);
  }

  @Delete(':boardId')
  @BoardRole(Role.OWNER)
  @UseGuards(BoardRoleGuard)
  deleteBoard(@Param('boardId') boardId: string) {
    return this.boardsService.deleteBoard(boardId);
  }
}
