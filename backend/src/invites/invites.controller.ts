import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardRole } from '../common/decorators/board-role.decorator';
import { BoardRoleGuard } from '../common/guards/board-role.guard';
import { CreateInviteDto } from './dto/invite.dto';
import { InvitesService } from './invites.service';

@Controller()
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('boards/:boardId/invites')
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRole(Role.OWNER)
  createInvite(
    @Param('boardId') boardId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(boardId, req.user!.id, dto);
  }

  @Get('invites/:token')
  getInviteInfo(@Param('token') token: string) {
    return this.invitesService.getInviteInfo(token);
  }
}
