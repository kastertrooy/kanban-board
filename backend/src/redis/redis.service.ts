import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private clientInstance!: Redis;

  constructor(private readonly configService: ConfigService) {}

  get client(): Redis {
    return this.clientInstance;
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('redisUrl')
      ?? this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      throw new Error('REDIS_URL is not configured');
    }

    this.clientInstance = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });

    await this.clientInstance.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.clientInstance) {
      await this.clientInstance.quit();
    }
  }

  get(key: string): Promise<string | null> {
    return this.clientInstance.get(key);
  }

  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<'OK' | null> {
    return this.clientInstance.set(key, value, mode, ttlSeconds);
  }

  del(key: string): Promise<number> {
    return this.clientInstance.del(key);
  }
}
