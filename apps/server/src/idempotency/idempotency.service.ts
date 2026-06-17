import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const duplicateCode = 'P2002';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    key: string | undefined,
    input: {
      route: string;
      scope?: string;
    },
    handler: () => Promise<T> | T,
  ): Promise<T> {
    const normalizedKey = key?.trim();
    if (!normalizedKey) return handler();

    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key: normalizedKey } });
    if (existing) {
      if (existing.route !== input.route || existing.scope !== input.scope) {
        throw new BadRequestException('Idempotency key reused for a different operation');
      }
      if (existing.status === 'completed') return existing.response as T;
      return this.waitForCompleted<T>(normalizedKey);
    }

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          key: normalizedKey,
          route: input.route,
          scope: input.scope,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (this.isDuplicate(error)) {
        return this.run(normalizedKey, input, handler);
      }
      throw error;
    }

    try {
      const response = await handler();
      const jsonResponse = this.toJsonValue(response);
      await this.prisma.idempotencyRecord.update({
        where: { key: normalizedKey },
        data: {
          status: 'completed',
          response: jsonResponse,
        },
      });
      return response;
    } catch (error) {
      await this.prisma.idempotencyRecord
        .update({
          where: { key: normalizedKey },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'unknown error',
          },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  private async waitForCompleted<T>(key: string): Promise<T> {
    for (let i = 0; i < 20; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
      if (!record) break;
      if (record.status === 'completed') return record.response as T;
      if (record.status === 'failed') throw new BadRequestException('Original idempotent request failed');
    }
    throw new BadRequestException('Idempotent request is still processing');
  }

  private isDuplicate(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === duplicateCode;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
