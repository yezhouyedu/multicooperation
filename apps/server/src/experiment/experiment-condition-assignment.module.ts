import { Module } from '@nestjs/common';
import { ExperimentConditionAssignmentService } from './experiment-condition-assignment.service';

@Module({
  providers: [ExperimentConditionAssignmentService],
  exports: [ExperimentConditionAssignmentService],
})
export class ExperimentConditionAssignmentModule {}
