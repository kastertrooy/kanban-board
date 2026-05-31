import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MagicLink, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';

type MockPrismaService = {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  magicLink: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

type MockRedisService = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
};

type MockConfigService = {
  get: jest.Mock;
};

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: MockPrismaService;
  let redisService: MockRedisService;
  let configService: MockConfigService;

  const baseUser: User = {
    id: 'user-1',
    telegramId: null,
    email: 'user@example.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    name: 'Test User',
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      magicLink: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    redisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          jwtSecret: 'test-secret',
          jwtExpiresIn: '7d',
          magicLinkTtl: 600,
          JWT_SECRET: 'test-secret',
          JWT_EXPIRES_IN: '7d',
          MAGIC_LINK_TTL: '600',
        };

        return values[key];
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('registers user successfully and returns JWT', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockImplementation(async ({ data }: { data: Partial<User> }) => ({
        ...baseUser,
        email: data.email ?? baseUser.email,
        name: data.name ?? baseUser.name,
        passwordHash: data.passwordHash ?? baseUser.passwordHash,
      }));

      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
      const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue('jwt-token' as never);

      const result = await authService.register({
        email: 'USER@EXAMPLE.COM',
        password: 'password123',
        name: '  Test User  ',
      });

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(hashSpy).toHaveBeenCalledWith('password123', 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'user@example.com',
          name: 'Test User',
          passwordHash: 'hashed-password',
        },
      });
      expect(signSpy).toHaveBeenCalledWith(
        {
          sub: baseUser.id,
          email: baseUser.email,
        },
        'test-secret',
        { expiresIn: '7d' },
      );
      expect(result).toEqual({ accessToken: 'jwt-token' });
    });

    it('throws if email already exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(baseUser);

      await expect(
        authService.register({
          email: 'user@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('logs in successfully with valid credentials', async () => {
      prismaService.user.findUnique.mockResolvedValue(baseUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(jwt, 'sign').mockReturnValue('jwt-token' as never);

      const result = await authService.login({
        email: 'USER@EXAMPLE.COM',
        password: 'password123',
      });

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(result).toEqual({ accessToken: 'jwt-token' });
    });

    it('throws for invalid password', async () => {
      prismaService.user.findUnique.mockResolvedValue(baseUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws for nonexistent user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'missing@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('generateMagicLink', () => {
    it('creates magic link in database and redis', async () => {
      prismaService.user.findUnique.mockResolvedValue(baseUser);
      prismaService.magicLink.create.mockResolvedValue({
        id: 'magic-1',
        userId: baseUser.id,
        token: 'generated-token',
        expiresAt: new Date(),
        isUsed: false,
        createdAt: new Date(),
      } satisfies MagicLink);
      redisService.set.mockResolvedValue('OK');

      const result = await authService.generateMagicLink({ userId: baseUser.id });

      expect(result.token).toEqual(expect.any(String));
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(redisService.set).toHaveBeenCalledWith(
        `magic:${result.token}`,
        baseUser.id,
        'EX',
        600,
      );
      expect(prismaService.magicLink.create).toHaveBeenCalledWith({
        data: {
          userId: baseUser.id,
          token: result.token,
          expiresAt: result.expiresAt,
          isUsed: false,
        },
      });
    });

    it('throws if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(authService.generateMagicLink({ userId: 'missing-user' })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(redisService.set).not.toHaveBeenCalled();
      expect(prismaService.magicLink.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyMagicLink', () => {
    it('returns JWT and marks magic link as used for valid token', async () => {
      const magicLinkRecord = {
        id: 'magic-1',
        userId: baseUser.id,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 60_000),
        isUsed: false,
        createdAt: new Date(),
        user: baseUser,
      };

      redisService.get.mockResolvedValue(baseUser.id);
      prismaService.magicLink.findUnique.mockResolvedValue(magicLinkRecord);
      prismaService.magicLink.update.mockResolvedValue({
        ...magicLinkRecord,
        isUsed: true,
      });
      prismaService.$transaction.mockImplementation(async (operations: [Promise<unknown>]) => Promise.all(operations));
      redisService.del.mockResolvedValue(1);
      jest.spyOn(jwt, 'sign').mockReturnValue('jwt-token' as never);

      const result = await authService.verifyMagicLink('valid-token');

      expect(prismaService.magicLink.findUnique).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
        include: { user: true },
      });
      expect(prismaService.magicLink.update).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
        data: { isUsed: true },
      });
      expect(redisService.del).toHaveBeenCalledWith('magic:valid-token');
      expect(result).toEqual({ accessToken: 'jwt-token' });
    });

    it('throws for invalid token missing in redis', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(authService.verifyMagicLink('invalid-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prismaService.magicLink.findUnique).not.toHaveBeenCalled();
    });

    it('throws for expired magic link', async () => {
      redisService.get.mockResolvedValue(baseUser.id);
      prismaService.magicLink.findUnique.mockResolvedValue({
        id: 'magic-1',
        userId: baseUser.id,
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 60_000),
        isUsed: false,
        createdAt: new Date(),
        user: baseUser,
      });

      await expect(authService.verifyMagicLink('expired-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prismaService.magicLink.update).not.toHaveBeenCalled();
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('throws when redis token exists but database record is missing', async () => {
      redisService.get.mockResolvedValue(baseUser.id);
      prismaService.magicLink.findUnique.mockResolvedValue(null);

      await expect(authService.verifyMagicLink('orphan-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prismaService.magicLink.update).not.toHaveBeenCalled();
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('throws for already used magic link', async () => {
      redisService.get.mockResolvedValue(baseUser.id);
      prismaService.magicLink.findUnique.mockResolvedValue({
        id: 'magic-1',
        userId: baseUser.id,
        token: 'used-token',
        expiresAt: new Date(Date.now() + 60_000),
        isUsed: true,
        createdAt: new Date(),
        user: baseUser,
      });

      await expect(authService.verifyMagicLink('used-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws for mismatched redis user id', async () => {
      redisService.get.mockResolvedValue('another-user');
      prismaService.magicLink.findUnique.mockResolvedValue({
        id: 'magic-1',
        userId: baseUser.id,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 60_000),
        isUsed: false,
        createdAt: new Date(),
        user: baseUser,
      });

      await expect(authService.verifyMagicLink('valid-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws for blank token', async () => {
      await expect(authService.verifyMagicLink('   ')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
