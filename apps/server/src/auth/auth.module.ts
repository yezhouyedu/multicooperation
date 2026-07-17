import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ExperimentConditionAssignmentModule } from '../experiment/experiment-condition-assignment.module';

@Module({
  imports: [ExperimentConditionAssignmentModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
