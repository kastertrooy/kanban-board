import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { Bot, Context, InlineKeyboard } from 'grammy';

import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

type TelegramUserShape = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot<Context> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN')
      ?? process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured, bot startup skipped');
      return;
    }

    this.bot = new Bot<Context>(token);
    this.registerHandlers(this.bot);
    this.bot.catch((error) => {
      this.logger.error(`Telegram bot error: ${error.message}`);
    });

    await this.bot.init();
    void this.bot.start({
      onStart: () => {
        this.logger.log('Telegram bot started via long polling');
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
    }
  }

  async sendTextMessage(telegramId: string, text: string): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Telegram bot is not initialized, message skipped');
      return;
    }

    await this.bot.api.sendMessage(telegramId, text);
  }

  private registerHandlers(bot: Bot<Context>): void {
    bot.command('start', async (ctx) => {
      const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';

      if (payload.startsWith('invite_')) {
        await this.handleInviteStart(ctx, payload.replace('invite_', ''));
        return;
      }

      if (payload === 'auth') {
        await this.handleAuthStart(ctx);
        return;
      }

      await this.handlePlainStart(ctx);
    });
  }

  private async handlePlainStart(ctx: Context): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const keyboard = new InlineKeyboard().url('Войти в Kanban', `${frontendUrl}/auth`);

    await ctx.reply('Добро пожаловать в Kanban!', {
      reply_markup: keyboard,
    });
  }

  private async handleAuthStart(ctx: Context): Promise<void> {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply('Не удалось определить пользователя Telegram.');
      return;
    }

    const user = await this.findOrCreateUserByTelegram(telegramUser);
    const magicLink = await this.authService.generateMagicLinkForUser(user.id);
    const keyboard = new InlineKeyboard().url(
      'Открыть Kanban',
      this.buildMagicLinkUrl(magicLink.token),
    );

    await ctx.reply('Ссылка для входа готова.', {
      reply_markup: keyboard,
    });
  }

  private async handleInviteStart(ctx: Context, token: string): Promise<void> {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply('Не удалось определить пользователя Telegram.');
      return;
    }

    const invite = await this.prisma.inviteLink.findUnique({
      where: { token },
      include: {
        board: {
          select: {
            id: true,
            title: true,
            ownerId: true,
          },
        },
      },
    });

    if (!invite || invite.isRevoked) {
      await ctx.reply('Инвайт недействителен или отозван.');
      return;
    }

    const user = await this.findOrCreateUserByTelegram(telegramUser);

    if (invite.board.ownerId !== user.id) {
      await this.prisma.boardMember.upsert({
        where: {
          boardId_userId: {
            boardId: invite.boardId,
            userId: user.id,
          },
        },
        update: {
          role: invite.role,
        },
        create: {
          boardId: invite.boardId,
          userId: user.id,
          role: invite.role,
        },
      });
    }

    const magicLink = await this.authService.generateMagicLinkForUser(user.id);
    const keyboard = new InlineKeyboard().url(
      'Открыть доску',
      this.buildMagicLinkUrl(magicLink.token),
    );

    await ctx.reply(`Вы добавлены на доску "${invite.board.title}"!`, {
      reply_markup: keyboard,
    });
  }

  private async findOrCreateUserByTelegram(telegramUser: TelegramUserShape): Promise<User> {
    const telegramId = String(telegramUser.id);
    const existingUser = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (existingUser) {
      return existingUser;
    }

    const fallbackName = this.buildTelegramDisplayName(telegramUser);

    return this.prisma.user.create({
      data: {
        telegramId,
        name: fallbackName,
        notificationSettings: {
          create: {
            onAssigned: true,
            onDeadline: true,
            onComment: true,
          },
        },
      },
    });
  }

  private buildTelegramDisplayName(telegramUser: TelegramUserShape): string {
    const fullName = [telegramUser.first_name, telegramUser.last_name]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ')
      .trim();

    if (fullName) {
      return fullName;
    }

    if (telegramUser.username) {
      return telegramUser.username;
    }

    return `Telegram User ${telegramUser.id}`;
  }

  private buildMagicLinkUrl(token: string): string {
    return `${this.getFrontendUrl()}/auth/magic?token=${token}`;
  }

  private getFrontendUrl(): string {
    return this.configService.get<string>('frontendUrl')
      ?? this.configService.get<string>('FRONTEND_URL')
      ?? 'http://localhost:3000';
  }
}
