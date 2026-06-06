import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { resolve } from 'path';
import { AdminService } from './admin.service';

const TEMP_UPLOAD_DIR = resolve(process.cwd(), 'storage', 'tmp');

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('participants')
  getParticipants() {
    return this.adminService.getParticipants();
  }

  @Post('participants')
  upsertParticipants(@Body() body: { entries: { phone: string }[] }) {
    return this.adminService.upsertParticipants(body.entries ?? []);
  }

  @Get('experiment-config')
  getExperimentConfig() {
    return this.adminService.getExperimentConfig();
  }

  @Post('experiment-config')
  saveExperimentConfig(@Body() body: {
    activeExperimentMode?: string;
    experimentModeSettings?: unknown;
    instructionBlocks?: unknown;
    practiceDurationMinutes: number;
    workDurationMinutes: number;
    breakDurationMinutes: number;
    segmentAiLevels: string[];
    questionnaireTitle?: string;
    questionnaireItems: { id?: string; prompt: string; options: string[] }[];
    practiceQuizTitle?: string;
    practiceQuizItems: { id?: string; prompt: string; options: string[]; correctOption?: string }[];
    practiceQuizPassCount?: number;
    sideTask?: {
      continuousIntervalSec?: number;
      continuousJitterSec?: number;
      scrollDurationSec?: number;
      holdSec?: number;
      fadeSec?: number;
      continuousPauseSec?: number;
      batchSizes?: string;
      batchTriggerSec?: number;
      batchPauseSec?: number;
    };
  }) {
    return this.adminService.saveExperimentConfig(body);
  }

  @Get('companies')
  getCompanies() {
    return this.adminService.getCompanies();
  }

  @Get('companies/:companyId')
  getCompany(@Param('companyId') companyId: string) {
    return this.adminService.getCompany(companyId);
  }

  @Post('companies')
  upsertCompany(@Body() body: {
    id?: string;
    name: string;
    roundLabel: string;
    sector: string;
    tags: string[];
    summary: string;
    sortOrder?: number;
  }) {
    return this.adminService.upsertCompany(body);
  }

  @Post('companies/import-baseline/p01')
  importBaselineP01() {
    return this.adminService.importBaselineP01();
  }

  @Get('companies/library/overview')
  getCaseLibraryOverview() {
    return this.adminService.getCaseLibraryOverview();
  }

  @Post('companies/import-library')
  importCaseLibrary() {
    return this.adminService.importCaseLibrary();
  }

  @Post('companies/:companyId/materials')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: TEMP_UPLOAD_DIR,
      }),
    }),
  )
  uploadMaterial(@Param('companyId') companyId: string, @UploadedFile() file: { originalname: string; path: string }) {
    return this.adminService.uploadMaterial(companyId, file);
  }

  @Post('companies/:companyId/materials/:materialId/replace')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: TEMP_UPLOAD_DIR,
      }),
    }),
  )
  replaceMaterial(
    @Param('companyId') companyId: string,
    @Param('materialId') materialId: string,
    @UploadedFile() file: { originalname: string; path: string },
  ) {
    return this.adminService.replaceMaterial(companyId, materialId, file);
  }

  @Delete('companies/:companyId/materials/:materialId')
  deleteMaterial(@Param('companyId') companyId: string, @Param('materialId') materialId: string) {
    return this.adminService.deleteMaterial(companyId, materialId);
  }

  @Patch('companies/:companyId/materials/reorder')
  reorderMaterials(@Param('companyId') companyId: string, @Body() body: { materialIds: string[] }) {
    return this.adminService.reorderCompanyMaterials(companyId, body.materialIds ?? []);
  }

  @Patch('companies/:companyId/materials/:materialId/auto-fill-source')
  setAutoFillSource(@Param('companyId') companyId: string, @Param('materialId') materialId: string) {
    return this.adminService.setAutoFillSource(companyId, materialId);
  }

  @Post('session/:code/init-tasks')
  initSessionTasks(@Param('code') code: string) {
    return this.adminService.initSessionTasks(code.toUpperCase());
  }

  @Post('clear-sessions')
  clearSessions() {
    return this.adminService.clearSessions();
  }

  @Get('sessions')
  getSessions() {
    return this.adminService.getSessions();
  }

  @Get('export')
  exportData() {
    return this.adminService.exportData();
  }

  @Get('ai-settings')
  getAiSettings() {
    return this.adminService.getAiSettings();
  }

  @Post('ai-settings')
  saveAiSettings(@Body() body: {
    basicBaseUrl?: string;
    basicModel?: string;
    basicApiKey?: string;
    basicContextLimit?: number;
    advancedBaseUrl?: string;
    advancedModel?: string;
    advancedApiKey?: string;
    advancedContextLimit?: number;
  }) {
    return this.adminService.saveAiSettings(body);
  }
}
