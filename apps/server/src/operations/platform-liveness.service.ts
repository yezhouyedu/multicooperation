import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformLivenessService implements OnModuleInit, OnModuleDestroy {
  private readonly instanceId = randomUUID();
  private readonly logger = new Logger(PlatformLivenessService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.pulse();
    this.timer = setInterval(() => { void this.pulse().catch(() => this.logger.warn('Platform liveness persistence failed; retrying on next pulse')); }, 5000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async pulse() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('platform-liveness'))`;
        const now = new Date();
        const previous = await tx.serverLiveness.findUnique({ where: { id: 'server' } });
        if (previous && (previous.instanceId !== this.instanceId || now.getTime() - previous.lastAliveAt.getTime() > 15000)) {
          const sessions = await tx.session.findMany({
            where: { OR: [
              { status: { in: ['MATCHED', 'IN_PROGRESS'] } },
              { status: { in: ['COMPLETED', 'TERMINATED'] }, updatedAt: { gte: previous.lastAliveAt } },
            ] },
            select: { id: true, currentPhase: true, currentSegmentIndex: true },
          });
          if (sessions.length) await tx.experimentEvent.createMany({ data: sessions.map((session) => ({
            sessionId: session.id,
            eventType: 'platform_service_interruption',
            phase: session.currentPhase,
            segmentIndex: session.currentSegmentIndex,
            serverTime: now,
            payload: {
              reason: previous.instanceId !== this.instanceId ? 'service_instance_changed' : 'liveness_gap',
              lastKnownAliveAt: previous.lastAliveAt.toISOString(), recoveredAt: now.toISOString(),
              previousInstanceId: previous.instanceId, instanceId: this.instanceId,
              exactOutageDurationKnown: false, requiresManualReview: true,
            },
          })) });
        }
        await tx.serverLiveness.upsert({ where: { id: 'server' }, create: { id: 'server', instanceId: this.instanceId, lastAliveAt: now }, update: { instanceId: this.instanceId, lastAliveAt: now } });
      });
    } finally { this.busy = false; }
  }
}
