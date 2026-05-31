import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BoardsModule } from '../boards/boards.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [ConfigModule, BoardsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
