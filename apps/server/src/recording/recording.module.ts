import { Global, Module } from '@nestjs/common';
import { ExperimentAuditService } from './experiment-audit.service';
import { ExportService } from './export.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [ExperimentAuditService, ExportService, StorageService],
  exports: [ExperimentAuditService, ExportService, StorageService],
})
export class RecordingModule {}
