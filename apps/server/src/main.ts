import { mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Force .env values to override system environment variables
try {
  const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#\s][^=]*)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import express, { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const uploadsRoot = resolve(process.cwd(), 'storage');
  mkdirSync(resolve(uploadsRoot, 'materials'), { recursive: true });
  mkdirSync(resolve(uploadsRoot, 'tmp'), { recursive: true });
  mkdirSync(resolve(uploadsRoot, 'exports'), { recursive: true });
  mkdirSync(resolve(uploadsRoot, 'attachments'), { recursive: true });

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });
  app.use(json({ limit: '10mb' }));
  app.use('/uploads/materials', (_req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    next();
  });
  app.use('/uploads/materials', express.static(resolve(uploadsRoot, 'materials')));
  const configService = app.get(ConfigService);
  const port = configService.get<number>('SERVER_PORT') ?? 3001;
  await app.listen(port);
}
bootstrap();
