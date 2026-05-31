import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardRole } from '../common/decorators/board-role.decorator';
import { BoardRoleGuard } from '../common/guards/board-role.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentsService } from './comments.service';

@Controller()
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('cards/:cardId/comments')
  @BoardRole(Role.VIEWER)
  createComment(
    @Param('cardId') cardId: string,
    @Body() dto: CreateCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.user!;
    return this.commentsService.createComment(cardId, user.id, dto);
  }

  @Patch('comments/:id')
  @BoardRole(Role.EDITOR)
  updateComment(@Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.commentsService.updateComment(id, dto.text);
  }

  @Delete('comments/:id')
  @BoardRole(Role.EDITOR)
  deleteComment(@Param('id') id: string) {
    return this.commentsService.deleteComment(id);
  }
}
