import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('frontendUrl')
    ?? configService.get<string>('FRONTEND_URL')
    ?? 'http://localhost:3000';
  const port = configService.get<number>('port')
    ?? configService.get<number>('PORT')
    ?? 4000;

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();
  await app.listen(port);

  Logger.log(`Backend is running on port ${port}`, 'Bootstrap');
}

bootstrap();
