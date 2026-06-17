import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ExperimentController } from './experiment/experiment.controller';
import { ExperimentService } from './experiment/experiment.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { PrismaModule } from './prisma/prisma.module';
import { RecordingModule } from './recording/recording.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AiModule,
    AuthModule,
    AdminModule,
    RecordingModule,
  ],
  controllers: [AppController, ExperimentController],
  providers: [AppService, ExperimentService, IdempotencyService],
})
export class AppModule {}
