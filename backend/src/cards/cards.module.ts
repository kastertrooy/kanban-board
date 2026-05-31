import { Module } from '@nestjs/common';

import { BoardsModule } from '../boards/boards.module';
import { CardsController } from './cards.controller';
import { CardService } from './card.service';

@Module({
  imports: [BoardsModule],
  controllers: [CardsController],
  providers: [CardService],
  exports: [CardService],
})
export class CardsModule {}
