import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GenerateMagicLinkDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './jwt-auth.guard';

export interface AuthResponse {
  accessToken: string;
}

export interface MagicLinkResponse {
  token: string;
  expiresAt: Date;
}

interface RedisKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
}

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
      },
    });

    return {
      accessToken: this.signToken(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: this.signToken(user),
    };
  }

  async generateMagicLink(dto: GenerateMagicLinkDto): Promise<MagicLinkResponse> {
    return this.generateMagicLinkForUser(dto.userId);
  }

  async generateMagicLinkForUser(userId: string): Promise<MagicLinkResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const ttlSeconds = this.getMagicLinkTtl();
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const redis = this.getRedisStore();

    await redis.set(this.getMagicRedisKey(token), user.id, 'EX', ttlSeconds);

    await this.prisma.magicLink.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        isUsed: false,
      },
    });

    return {
      token,
      expiresAt,
    };
  }

  async verifyMagicLink(token: string): Promise<AuthResponse> {
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      throw new BadRequestException('Token is required');
    }

    const redis = this.getRedisStore();
    const userId = await redis.get(this.getMagicRedisKey(normalizedToken));

    if (!userId) {
      throw new UnauthorizedException('Magic link is invalid or expired');
    }

    const magicLink = await this.prisma.magicLink.findUnique({
      where: { token: normalizedToken },
      include: {
        user: true,
      },
    });

    if (!magicLink || magicLink.isUsed || magicLink.userId !== userId) {
      throw new UnauthorizedException('Magic link is invalid or already used');
    }

    if (magicLink.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Magic link is expired');
    }

    await this.prisma.$transaction([
      this.prisma.magicLink.update({
        where: { token: normalizedToken },
        data: { isUsed: true },
      }),
    ]);

    await redis.del(this.getMagicRedisKey(normalizedToken));

    return {
      accessToken: this.signToken(magicLink.user),
    };
  }

  private signToken(user: Pick<User, 'id' | 'email'>): string {
    const secret = (
      this.configService.get<string>('jwtSecret')
      ?? this.configService.get<string>('JWT_SECRET')
    ) as string;
    const expiresIn = (
      this.configService.get<string>('jwtExpiresIn')
      ?? this.configService.get<string>('JWT_EXPIRES_IN')
    ) as string;

    if (!secret || !expiresIn) {
      throw new InternalServerErrorException('JWT configuration is incomplete');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? '',
    };

    return sign(payload, secret, { expiresIn: expiresIn as any });
  }

  private getMagicLinkTtl(): number {
    const ttl = this.configService.get<number>('magicLinkTtl')
      ?? Number(this.configService.get<string>('MAGIC_LINK_TTL'));

    if (!ttl || Number.isNaN(ttl) || ttl <= 0) {
      return 600;
    }

    return ttl;
  }

  private getMagicRedisKey(token: string): string {
    return `magic:${token}`;
  }

  private getRedisStore(): RedisKeyValueStore {
    const candidate = this.redisService as unknown as Partial<RedisKeyValueStore> & {
      client?: RedisKeyValueStore;
      getClient?: () => RedisKeyValueStore;
    };

    if (typeof candidate.get === 'function' && typeof candidate.set === 'function') {
      return candidate as RedisKeyValueStore;
    }

    if (candidate.client) {
      return candidate.client;
    }

    if (typeof candidate.getClient === 'function') {
      return candidate.getClient();
    }

    throw new InternalServerErrorException('Redis service interface is not supported');
  }
}
