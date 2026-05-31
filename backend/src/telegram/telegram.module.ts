import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
