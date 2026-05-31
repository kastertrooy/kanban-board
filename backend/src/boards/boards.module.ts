import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { BoardRoleGuard } from '../common/guards/board-role.guard';
import { BoardsController } from './boards.controller';
import { BoardGateway } from './board.gateway';
import { BoardsService } from './boards.service';

@Module({
  controllers: [BoardsController],
  providers: [BoardGateway, BoardsService, BoardRoleGuard, Reflector],
  exports: [BoardGateway, BoardsService, BoardRoleGuard],
})
export class BoardsModule {}
