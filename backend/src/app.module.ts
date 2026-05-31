import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BoardsModule } from './boards/boards.module';
import { CardsModule } from './cards/cards.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { CommentsModule } from './comments/comments.module';
import { ColumnsModule } from './columns/columns.module';
import configuration from './config/configuration';
import { FieldsModule } from './fields/fields.module';
import { InvitesModule } from './invites/invites.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    BoardsModule,
    ColumnsModule,
    CardsModule,
    CommentsModule,
    ChecklistsModule,
    FieldsModule,
    InvitesModule,
    TelegramModule,
    NotificationsModule,
  ],
})
export class AppModule {}
