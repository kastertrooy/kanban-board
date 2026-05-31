import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  async notifyAssigned(userId: string, cardTitle: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        notificationSettings: true,
      },
    });

    if (!user?.telegramId) {
      return;
    }

    if (user.notificationSettings && !user.notificationSettings.onAssigned) {
      return;
    }

    await this.telegramService.sendTextMessage(
      user.telegramId,
      `Вам назначена карточка: ${cardTitle}`,
    );
  }

  async notifyDeadline(userId: string, cardTitle: string, deadline: Date): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        notificationSettings: true,
      },
    });

    if (!user?.telegramId) {
      return;
    }

    if (user.notificationSettings && !user.notificationSettings.onDeadline) {
      return;
    }

    await this.telegramService.sendTextMessage(
      user.telegramId,
      `Срок по карточке "${cardTitle}": ${deadline.toISOString()}`,
    );
  }

  async notifyComment(userId: string, cardTitle: string, authorName: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        notificationSettings: true,
      },
    });

    if (!user?.telegramId) {
      return;
    }

    if (user.notificationSettings && !user.notificationSettings.onComment) {
      return;
    }

    await this.telegramService.sendTextMessage(
      user.telegramId,
      `${authorName} оставил комментарий в карточке "${cardTitle}"`,
    );
  }
}
