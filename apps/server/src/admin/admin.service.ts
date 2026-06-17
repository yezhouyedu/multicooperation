import { AiLevel, ExperimentPhase, Prisma, QuestionnaireTemplate } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { basename, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CASE_LIBRARY_ROOT,
  FORMAL_CASE_LIBRARY_ROOT,
  PRACTICE_CASE_LIBRARY_ROOT,
  StoredMaterialItem,
  buildMaterialPublicUrl,
  createStoredMaterialItem,
  ensureBaselineP01Files,
  normalizeMaterials,
  parseResearchProfileFromText,
  readUtf8File,
  removeStoredMaterial,
  reorderMaterials,
  scanCaseLibrary,
} from './materials';
import { storagePath } from '../storage-paths';
import {
  FORMAL_QUESTIONNAIRE_TEMPLATE_ID,
  formalQuestionnaireTemplateJson,
} from '../questionnaire/three-chapter-v1-1';

type CompanyWithMaterials = {
  id: string;
  name: string;
  roundLabel: string;
  sector: string;
  usage?: string;
  tags: Prisma.JsonValue;
  summary: string;
  materials: Prisma.JsonValue;
  researchProfile: Prisma.JsonValue | null;
  autoFillSourceMaterialId: string | null;
  sortOrder: number;
};

type SingleChoiceQuestionInput = {
  id?: string;
  prompt: string;
  options: string[];
  correctOption?: string;
};

type FormalQuestionnaireInput = Prisma.InputJsonValue | Record<string, unknown> | null | undefined;

type ExperimentMode = 'manual' | 'ai_upgrade' | 'side_reminder' | 'coop_narrative';

const EXPERIMENT_MODES = new Set<ExperimentMode>(['manual', 'ai_upgrade', 'side_reminder', 'coop_narrative']);

const DEFAULT_EXPERIMENT_MODE_SETTINGS = {
  ai_upgrade: {
    fixedSideDispatchMode: 'continuous',
    fixedNarrativeGroup: 'neutral_info',
  },
  side_reminder: {
    fixedAiLevel: 'BASIC',
    fixedNarrativeGroup: 'neutral_info',
  },
  coop_narrative: {
    fixedAiLevel: 'BASIC',
    fixedSideDispatchMode: 'continuous',
  },
};

const DEFAULT_INSTRUCTION_BLOCKS = {
  commonTitle: '开始前，请先阅读以下提示',
  commonBody: '本实验会先完成测试题和测试轮，再进入正式任务。请尽量保持页面开启，不要随意刷新或关闭浏览器窗口。',
  roleA: '你需要阅读材料、记录关键信息，并整理出供投资经理使用的尽调内容。',
  roleB: '你需要综合自有材料、尽调信息和自己的判断，完成投资决策并给出反馈。',
  manual: '',
  ai_upgrade: '正式任务中，AI 辅助能力可能会在不同阶段发生变化。请以页面中显示的当前 AI 状态为准。',
  side_reminder: '正式任务中，待处理事宜会按系统安排进入队列。请在主线任务与待处理事宜之间合理分配注意力。',
  coop_narrative: '正式任务中，待处理事宜可能包含与团队协作相关的信息。请正常阅读并完成对应判断。',
  aiUpgradeBreakNotice: '下一阶段起，AI 辅助功能已升级，您可以上传图片并使用更强模型辅助分析。',
  aiUpgradeWorkspaceNotice: '当前 AI 辅助功能已升级。',
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertParticipants(entries: { phone: string }[]) {
    let inserted = 0;
    let updated = 0;
    for (const entry of entries) {
      const phone = entry.phone?.trim();
      if (!phone) continue;
      const existing = await this.prisma.participant.findUnique({ where: { phone } });
      if (existing) {
        await this.prisma.participant.update({
          where: { phone },
          data: { phone, role: null },
        });
        updated++;
      } else {
        await this.prisma.participant.create({ data: { phone } });
        inserted++;
      }
    }
    return { ok: true, inserted, updated, total: entries.length };
  }

  async getParticipants() {
    const list = await this.prisma.participant.findMany({
      where: { phone: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, phone: true, createdAt: true },
    });
    return { ok: true, participants: list };
  }

  async deleteParticipant(id: string) {
    const participant = await this.prisma.participant.findUnique({ where: { id } });
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }
    await this.prisma.participant.delete({ where: { id } });
    return { ok: true, deleted: 1 };
  }

  async deleteParticipants(ids: string[]) {
    if (!ids || ids.length === 0) {
      return { ok: true, deleted: 0 };
    }
    const result = await this.prisma.participant.deleteMany({
      where: { id: { in: ids } },
    });
    return { ok: true, deleted: result.count };
  }

  async getExperimentConfig() {
    const config = await this.ensureExperimentConfig();
    return {
      ok: true,
      config: {
        id: config.id,
        activeExperimentMode: config.activeExperimentMode,
        experimentModeSettings: this.normalizeExperimentModeSettings(config.experimentModeSettings),
        instructionBlocks: this.normalizeInstructionBlocks(config.instructionBlocks),
        practiceDurationMinutes: config.practiceDurationMinutes,
        workDurationMinutes: config.workDurationMinutes,
        breakDurationMinutes: config.breakDurationMinutes,
        segmentAiLevels: [
          config.segmentOneAiLevel,
          config.segmentTwoAiLevel,
          config.segmentThreeAiLevel,
        ],
        questionnaireTemplate: config.activeQuestionnaireTemplate
          ? {
              id: config.activeQuestionnaireTemplate.id,
              title: config.activeQuestionnaireTemplate.title,
              items: config.activeQuestionnaireTemplate.items,
            }
          : null,
        practiceQuizTemplate: config.practiceQuizTemplate
          ? {
              id: config.practiceQuizTemplate.id,
              title: config.practiceQuizTemplate.title,
              items: config.practiceQuizTemplate.items,
            }
          : null,
        practiceQuizPassCount: config.practiceQuizPassCount,
        feedbackNotificationDurationSec: config.feedbackNotificationDurationSec,
        sideTask: {
          continuousIntervalSec: config.sideTaskContinuousIntervalSec,
          continuousJitterSec: config.sideTaskContinuousJitterSec,
          scrollDurationSec: config.sideTaskScrollDurationSec,
          holdSec: config.sideTaskHoldSec,
          fadeSec: config.sideTaskFadeSec,
          continuousPauseSec: config.sideTaskContinuousPauseSec,
          batchSizes: config.sideTaskBatchSizes,
          batchTriggerSec: config.sideTaskBatchTriggerSec,
          batchPauseSec: config.sideTaskBatchPauseSec,
        },
      },
    };
  }

  async saveExperimentConfig(input: {
    activeExperimentMode?: string;
    experimentModeSettings?: unknown;
    instructionBlocks?: unknown;
    practiceDurationMinutes: number;
    workDurationMinutes: number;
    breakDurationMinutes: number;
    segmentAiLevels: string[];
    questionnaireTitle?: string;
    questionnaireItems: FormalQuestionnaireInput;
    practiceQuizTitle?: string;
    practiceQuizItems: SingleChoiceQuestionInput[];
    practiceQuizPassCount?: number;
    feedbackNotificationDurationSec?: number;
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
    const template = await this.prisma.questionnaireTemplate.upsert({
      where: { id: FORMAL_QUESTIONNAIRE_TEMPLATE_ID },
      update: {
        title: input.questionnaireTitle?.trim() || 'three-chapter-questionnaire-v1.1',
        items: this.normalizeFormalQuestionnaireTemplate(input.questionnaireItems),
        isActive: true,
      },
      create: {
        id: FORMAL_QUESTIONNAIRE_TEMPLATE_ID,
        title: input.questionnaireTitle?.trim() || 'three-chapter-questionnaire-v1.1',
        items: this.normalizeFormalQuestionnaireTemplate(input.questionnaireItems),
        isActive: true,
      },
    });

    const practiceQuizItems = (input.practiceQuizItems ?? [])
      .map((item, index) => {
        const options = (item.options ?? []).map((option) => option.trim()).filter(Boolean);
        const correctOption = item.correctOption?.trim() ?? '';
        return {
          id: item.id?.trim() || `pq${index + 1}`,
          prompt: item.prompt?.trim() || '',
          options,
          correctOption: options.includes(correctOption) ? correctOption : options[0] ?? '',
        };
      })
      .filter((item) => item.prompt && item.options.length >= 2 && item.correctOption);

    const practiceTemplate = await this.prisma.questionnaireTemplate.upsert({
      where: { id: 'default-practice-quiz' },
      update: {
        title: input.practiceQuizTitle?.trim() || '\u6d4b\u8bd5\u8f6e\u5f00\u59cb\u524d\u6d4b\u8bd5\u9898',
        items: practiceQuizItems as Prisma.InputJsonValue,
        isActive: true,
      },
      create: {
        id: 'default-practice-quiz',
        title: input.practiceQuizTitle?.trim() || '\u6d4b\u8bd5\u8f6e\u5f00\u59cb\u524d\u6d4b\u8bd5\u9898',
        items: practiceQuizItems as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    const [segmentOneAiLevel, segmentTwoAiLevel, segmentThreeAiLevel] =
      this.normalizeAiLevels(input.segmentAiLevels);
    const activeExperimentMode = this.normalizeExperimentMode(input.activeExperimentMode);
    const experimentModeSettings = this.normalizeExperimentModeSettings(input.experimentModeSettings);
    const instructionBlocks = this.normalizeInstructionBlocks(input.instructionBlocks);

    const st = input.sideTask;
    const sideTaskData = st
      ? {
          sideTaskContinuousIntervalSec: Math.max(1, Number(st.continuousIntervalSec) || 45),
          sideTaskContinuousJitterSec: Math.max(0, Number(st.continuousJitterSec) || 15),
          sideTaskScrollDurationSec: Math.max(1, Number(st.scrollDurationSec) || 12),
          sideTaskHoldSec: Math.max(0, Number(st.holdSec) || 5),
          sideTaskFadeSec: Math.max(0, Number(st.fadeSec) || 2),
          sideTaskContinuousPauseSec: Math.max(1, Number(st.continuousPauseSec) || 15),
          sideTaskBatchSizes: this.validateBatchSizes(st.batchSizes ?? '10,15,15'),
          sideTaskBatchTriggerSec: Math.max(1, Number(st.batchTriggerSec) || 180),
          sideTaskBatchPauseSec: Math.max(1, Number(st.batchPauseSec) || 60),
        }
      : {};

    const config = await this.prisma.experimentConfig.upsert({
      where: { id: 'default' },
      update: {
        activeExperimentMode,
        experimentModeSettings: experimentModeSettings as Prisma.InputJsonValue,
        instructionBlocks: instructionBlocks as Prisma.InputJsonValue,
        practiceDurationMinutes: Math.max(1, Number(input.practiceDurationMinutes) || 10),
        workDurationMinutes: Math.max(1, Number(input.workDurationMinutes) || 20),
        breakDurationMinutes: Math.max(1, Number(input.breakDurationMinutes) || 5),
        segmentOneAiLevel,
        segmentTwoAiLevel,
        segmentThreeAiLevel,
        activeQuestionnaireTemplateId: template.id,
        practiceQuizTemplateId: practiceTemplate.id,
        practiceQuizPassCount: Math.max(0, Number(input.practiceQuizPassCount) || 0),
        feedbackNotificationDurationSec: Math.max(1, Number(input.feedbackNotificationDurationSec) || 10),
        ...sideTaskData,
      },
      create: {
        id: 'default',
        activeExperimentMode,
        experimentModeSettings: experimentModeSettings as Prisma.InputJsonValue,
        instructionBlocks: instructionBlocks as Prisma.InputJsonValue,
        practiceDurationMinutes: Math.max(1, Number(input.practiceDurationMinutes) || 10),
        workDurationMinutes: Math.max(1, Number(input.workDurationMinutes) || 20),
        breakDurationMinutes: Math.max(1, Number(input.breakDurationMinutes) || 5),
        segmentOneAiLevel,
        segmentTwoAiLevel,
        segmentThreeAiLevel,
        activeQuestionnaireTemplateId: template.id,
        practiceQuizTemplateId: practiceTemplate.id,
        practiceQuizPassCount: Math.max(0, Number(input.practiceQuizPassCount) || 0),
        feedbackNotificationDurationSec: Math.max(1, Number(input.feedbackNotificationDurationSec) || 10),
        ...sideTaskData,
      },
      include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
    });

    return { ok: true, config };
  }

  async getCompanies() {
    await this.ensureBaselineCompanyIfMissing();
    const list = await this.prisma.company.findMany({ orderBy: { sortOrder: 'asc' } });
    const usable = list.filter((company) => this.isUsableCompany(company));
    return {
      ok: true,
      companies: usable.map((company) => this.serializeCompany(company)),
    };
  }

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    const fallbackCompany =
      !this.isUsableCompany(company)
        ? await this.prisma.company.findUnique({ where: { id: 'company-p01-baseline' } })
        : null;
    return { ok: true, company: this.serializeCompany(company, fallbackCompany) };
  }

  async upsertCompany(data: {
    id?: string;
    name: string;
    roundLabel: string;
    sector: string;
    tags: string[];
    summary: string;
    sortOrder?: number;
  }) {
    if (data.id) {
      const existing = await this.prisma.company.findUnique({ where: { id: data.id } });
      if (!existing) throw new NotFoundException('Company not found');
      const company = await this.prisma.company.update({
        where: { id: data.id },
        data: {
          name: data.name,
          roundLabel: data.roundLabel,
          sector: data.sector,
          tags: data.tags,
          summary: data.summary,
          sortOrder: data.sortOrder ?? 0,
        },
      });
      return { ok: true, company: this.serializeCompany(company) };
    }

    const company = await this.prisma.company.create({
      data: {
        name: data.name,
        roundLabel: data.roundLabel,
        sector: data.sector,
        tags: data.tags,
        summary: data.summary,
        materials: [] as never,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    return { ok: true, company: this.serializeCompany(company) };
  }

  async uploadMaterial(companyId: string, file: { originalname: string; path: string }) {
    const company = (await this.prisma.company.findUnique({ where: { id: companyId } })) as CompanyWithMaterials | null;
    if (!company) throw new NotFoundException('Company not found');

    const materials = normalizeMaterials(company.materials);
    const next = createStoredMaterialItem({
      companyId,
      originalFilename: file.originalname,
      sourcePath: file.path,
      sortOrder: materials.length,
    });
    const nextMaterials = [...materials, next];
    const autoFillSourceMaterialId =
      company.autoFillSourceMaterialId ??
      (next.kind === 'txt' && next.displayName.includes('信息点记录') ? next.id : null);
    const researchProfile = autoFillSourceMaterialId === next.id
      ? this.tryParseResearchProfile(companyId, next)
      : company.researchProfile;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        materials: nextMaterials as never,
        autoFillSourceMaterialId: autoFillSourceMaterialId ?? undefined,
        researchProfile: researchProfile as never,
      } as Prisma.CompanyUncheckedUpdateInput,
    });
    return { ok: true, company: this.serializeCompany(updated), material: next };
  }

  async replaceMaterial(companyId: string, materialId: string, file: { originalname: string; path: string }) {
    const company = (await this.prisma.company.findUnique({ where: { id: companyId } })) as CompanyWithMaterials | null;
    if (!company) throw new NotFoundException('Company not found');
    const materials = normalizeMaterials(company.materials);
    const target = materials.find((item) => item.id === materialId);
    if (!target) throw new NotFoundException('Material not found');

    removeStoredMaterial(companyId, target.storageKey);
    const replacement = {
      ...createStoredMaterialItem({
      companyId,
      originalFilename: file.originalname,
      sourcePath: file.path,
      sortOrder: target.sortOrder,
      }),
      id: target.id,
    };
    const nextMaterials = materials
      .map((item) => (item.id === materialId ? replacement : item))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const researchProfile = company.autoFillSourceMaterialId === materialId
      ? this.tryParseResearchProfile(companyId, replacement)
      : company.researchProfile;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        materials: nextMaterials as never,
        researchProfile: researchProfile as never,
      } as Prisma.CompanyUncheckedUpdateInput,
    });
    return { ok: true, company: this.serializeCompany(updated), material: replacement };
  }

  async deleteMaterial(companyId: string, materialId: string) {
    const company = (await this.prisma.company.findUnique({ where: { id: companyId } })) as CompanyWithMaterials | null;
    if (!company) throw new NotFoundException('Company not found');
    const materials = normalizeMaterials(company.materials);
    const target = materials.find((item) => item.id === materialId);
    if (!target) throw new NotFoundException('Material not found');

    removeStoredMaterial(companyId, target.storageKey);
    const nextMaterials = materials
      .filter((item) => item.id !== materialId)
      .map((item, index) => ({ ...item, sortOrder: index }));
    const isAutoFillSource = company.autoFillSourceMaterialId === materialId;
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        materials: nextMaterials as never,
        autoFillSourceMaterialId: isAutoFillSource ? null : company.autoFillSourceMaterialId,
        researchProfile: isAutoFillSource ? Prisma.DbNull : company.researchProfile,
      } as Prisma.CompanyUncheckedUpdateInput,
    });
    return { ok: true, company: this.serializeCompany(updated) };
  }

  async reorderCompanyMaterials(companyId: string, materialIds: string[]) {
    const company = (await this.prisma.company.findUnique({ where: { id: companyId } })) as CompanyWithMaterials | null;
    if (!company) throw new NotFoundException('Company not found');
    const materials = normalizeMaterials(company.materials);
    const nextMaterials = reorderMaterials(materials, materialIds);
    if (nextMaterials.length !== materials.length) {
      throw new BadRequestException('Material order list is incomplete');
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { materials: nextMaterials as never },
    });
    return { ok: true, company: this.serializeCompany(updated) };
  }

  async setAutoFillSource(companyId: string, materialId: string) {
    const company = (await this.prisma.company.findUnique({ where: { id: companyId } })) as CompanyWithMaterials | null;
    if (!company) throw new NotFoundException('Company not found');
    const materials = normalizeMaterials(company.materials);
    const target = materials.find((item) => item.id === materialId);
    if (!target) throw new NotFoundException('Material not found');
    if (target.kind !== 'txt') {
      throw new BadRequestException('Only txt materials can be used as auto fill source in current version');
    }

    const researchProfile = this.tryParseResearchProfile(companyId, target);
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        autoFillSourceMaterialId: materialId,
        researchProfile: researchProfile as never,
      } as Prisma.CompanyUncheckedUpdateInput,
    });
    return { ok: true, company: this.serializeCompany(updated) };
  }

  async importBaselineP01() {
    const files = ensureBaselineP01Files();
    if (files.length === 0) {
      throw new NotFoundException('P01 baseline folder not found');
    }

    const existing = (await this.prisma.company.findUnique({
      where: { id: 'company-p01-baseline' },
    })) as CompanyWithMaterials | null;
    const company = existing
      ? await this.prisma.company.update({
          where: { id: existing.id },
          data: {
            name: 'P01',
            roundLabel: 'P01',
            sector: '待从研究者文件同步',
            summary: 'P01 基线材料集',
            tags: ['P01', '基线材料'] as never,
            materials: [] as never,
          },
        })
      : await this.prisma.company.create({
          data: {
            id: 'company-p01-baseline',
            name: 'P01',
            roundLabel: 'P01',
            sector: '待从研究者文件同步',
            summary: 'P01 基线材料集',
            tags: ['P01', '基线材料'] as never,
            materials: [] as never,
            sortOrder: 1,
          },
        });

    for (const current of normalizeMaterials(company.materials)) {
      removeStoredMaterial(company.id, current.storageKey);
    }

    const materials: StoredMaterialItem[] = files.map((file, index) =>
      createStoredMaterialItem({
        companyId: company.id,
        originalFilename: basename(file.fullPath),
        sourcePath: file.fullPath,
        sortOrder: index,
      }),
    );
    const sourceMaterial =
      materials.find((item) => item.displayName.includes('信息点记录') && item.kind === 'txt') ?? null;
    const researchProfile = sourceMaterial ? this.tryParseResearchProfile(company.id, sourceMaterial) : null;

    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        name: researchProfile?.companyCode || 'P01',
        roundLabel: researchProfile?.companyCode || 'P01',
        sector: researchProfile?.industry || '待完善',
        summary: researchProfile?.businessSummary || 'P01 基线材料集',
        materials: materials as never,
        autoFillSourceMaterialId: sourceMaterial?.id ?? null,
        researchProfile: researchProfile as never,
      },
    });
    return { ok: true, company: this.serializeCompany(updated) };
  }

  async getCaseLibraryOverview() {
    const cases = scanCaseLibrary();
    return {
      ok: true,
      rootDir: CASE_LIBRARY_ROOT,
      formalRootDir: FORMAL_CASE_LIBRARY_ROOT,
      practiceRootDir: PRACTICE_CASE_LIBRARY_ROOT,
      cases: cases.map((item) => ({
        folderName: item.folderName,
        caseCode: item.caseCode,
        companyName: item.companyName,
        sector: item.sector,
        usage: item.usage,
        participantMaterialCount: item.participantMaterials.length,
        diligenceMaterialCount: item.participantMaterials.filter((material) => material.participantRole === 'A').length,
        managerMaterialCount: item.participantMaterials.filter((material) => material.participantRole === 'B').length,
        sharedMaterialCount: item.participantMaterials.filter((material) => material.participantRole === 'shared').length,
        researchMaterialCount: item.researchMaterials.length,
        autoFillSourceRelativePath: item.autoFillSourceRelativePath,
      })),
    };
  }

  async importCaseLibrary() {
    const cases = scanCaseLibrary();
    if (cases.length === 0) {
      throw new NotFoundException('No case folders found in case library root');
    }

    const imported: string[] = [];
    for (const definition of cases) {
      const companyId = this.buildLibraryCompanyId(definition.caseCode, definition.usage);
      const existing = (await this.prisma.company.findUnique({
        where: { id: companyId },
      })) as CompanyWithMaterials | null;

      if (existing) {
        for (const current of normalizeMaterials(existing.materials)) {
          removeStoredMaterial(existing.id, current.storageKey);
        }
      }

      const baseCompany = existing
        ? await this.prisma.company.update({
            where: { id: companyId },
            data: {
              name: definition.companyName,
              roundLabel: definition.roundLabel,
              sector: definition.sector,
              summary: definition.summary,
              usage: definition.usage,
              tags: definition.tags as never,
              materials: [] as never,
              sortOrder: definition.sortOrder,
            },
          })
        : await this.prisma.company.create({
            data: {
              id: companyId,
              name: definition.companyName,
              roundLabel: definition.roundLabel,
              sector: definition.sector,
              summary: definition.summary,
              usage: definition.usage,
              tags: definition.tags as never,
              materials: [] as never,
              sortOrder: definition.sortOrder,
            },
          });

      const allMaterials = [...definition.participantMaterials, ...definition.researchMaterials];
      const participantPaths = new Set(definition.participantMaterials.map((item) => item.relativePath));
      const participantRoleByPath = new Map(
        definition.participantMaterials.map((item) => [item.relativePath, item.participantRole] as const),
      );
      const materials: StoredMaterialItem[] = allMaterials.map((file, index) => {
        const isParticipantMaterial = participantPaths.has(file.relativePath);
        return createStoredMaterialItem({
          companyId,
          originalFilename: file.displayName,
          displayName: file.displayName,
          sourcePath: file.fullPath,
          sortOrder: index,
          metadata: {
            audience: isParticipantMaterial ? 'participant' : 'research',
            participantRole: isParticipantMaterial ? participantRoleByPath.get(file.relativePath) ?? 'shared' : null,
            importRelativePath: file.relativePath,
            importFolderName: definition.folderName,
            importedFromLibrary: true,
          },
        });
      });

      const sourceMaterial =
        materials.find((item) => item.metadata.importRelativePath === definition.autoFillSourceRelativePath) ?? null;
      const researchProfile = sourceMaterial ? this.tryParseResearchProfile(baseCompany.id, sourceMaterial) : null;

      await this.prisma.company.update({
        where: { id: baseCompany.id },
        data: {
          materials: materials as never,
          autoFillSourceMaterialId: sourceMaterial?.id ?? null,
          researchProfile: researchProfile as never,
        },
      });
      imported.push(baseCompany.id);
    }

    return {
      ok: true,
      importedCompanyIds: imported,
      totalImported: imported.length,
      rootDir: CASE_LIBRARY_ROOT,
      formalRootDir: FORMAL_CASE_LIBRARY_ROOT,
      practiceRootDir: PRACTICE_CASE_LIBRARY_ROOT,
    };
  }

  async initSessionTasks(sessionCode: string) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) return { ok: false, error: 'session not found' };
    await this.prisma.taskAssignment.deleteMany({ where: { sessionId: session.id } });

    await this.ensureBaselineCompanyIfMissing();
    const companies = (await this.prisma.company.findMany({ orderBy: { sortOrder: 'asc' } })).filter((company) => this.isUsableCompany(company));
    const formalCompanies = companies.filter((company) => (company.usage ?? 'formal') !== 'practice');
    const practiceCompanies = companies.filter((company) => (company.usage ?? 'formal') === 'practice');
    if (formalCompanies.length === 0) {
      throw new BadRequestException('No usable companies with uploaded materials are available');
    }
    const practiceCompany = practiceCompanies[0] ?? formalCompanies[0];
    if (practiceCompany) {
      await this.prisma.taskAssignment.create({
        data: {
          sessionId: session.id,
          companyId: practiceCompany.id,
          phase: ExperimentPhase.PRACTICE,
          sortOrder: 0,
          sequenceIndex: 0,
        },
      });
    }

    const shuffled = [...formalCompanies].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      await this.prisma.taskAssignment.create({
        data: {
          sessionId: session.id,
          companyId: shuffled[i].id,
          phase: ExperimentPhase.FORMAL,
          sortOrder: i + 1,
          sequenceIndex: i + 1,
        },
      });
    }
    return { ok: true, tasksCreated: shuffled.length + (practiceCompany ? 1 : 0) };
  }

  async clearSessions() {
    await this.prisma.taskProgress.deleteMany({});
    await this.prisma.taskSnapshot.deleteMany({});
    await this.prisma.questionnaireResponse.deleteMany({});
    await this.prisma.sideTaskExposureLog.deleteMany({});
    await this.prisma.sideTaskPlan.deleteMany({});
    await this.prisma.sideTaskSessionConfig.deleteMany({});
    await this.prisma.aiMessageLog.deleteMany({});
    await this.prisma.experimentEvent.deleteMany({});
    await this.prisma.randomizationAudit.deleteMany({});
    await this.prisma.sessionSegmentState.deleteMany({});
    await this.prisma.taskAssignment.deleteMany({});
    await this.prisma.pairing.deleteMany({});
    await this.prisma.session.deleteMany({});
    await this.prisma.participant.updateMany({ data: { role: null } });
    return {
      ok: true,
      message: '已清空全部实验运行数据，并重置参与者临时角色字段',
    };
  }

  async deleteSessions(input: { codes?: string[]; ids?: string[] }) {
    const codes = (input.codes ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean);
    const ids = (input.ids ?? []).map((id) => id.trim()).filter(Boolean);
    if (codes.length === 0 && ids.length === 0) {
      return { ok: true, deleted: 0 };
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        OR: [
          codes.length ? { code: { in: codes } } : undefined,
          ids.length ? { id: { in: ids } } : undefined,
        ].filter(Boolean) as Prisma.SessionWhereInput[],
      },
      include: { pairings: true },
    });
    const sessionIds = sessions.map((session) => session.id);
    const participantIds = Array.from(new Set(
      sessions.flatMap((session) =>
        session.pairings.flatMap((pairing) => [pairing.participantAId, pairing.participantBId]).filter(Boolean),
      ),
    )) as string[];

    if (sessionIds.length === 0) {
      return { ok: true, deleted: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.taskProgress.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.taskSnapshot.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.questionnaireResponse.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.sideTaskExposureLog.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.sideTaskPlan.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.sideTaskSessionConfig.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.aiMessageLog.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.experimentEvent.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.randomizationAudit.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.sessionSegmentState.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.taskAssignment.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.pairing.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
      if (participantIds.length > 0) {
        await tx.participant.updateMany({ where: { id: { in: participantIds } }, data: { role: null } });
      }
    });

    return { ok: true, deleted: sessionIds.length, releasedParticipantIds: participantIds };
  }

  async getSessions() {
    const sessions = await this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        pairings: {
          include: {
            participantA: { select: { id: true, phone: true, role: true } },
            participantB: { select: { id: true, phone: true, role: true } },
          },
        },
        segmentStates: {
          orderBy: { segmentIndex: 'asc' },
        },
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: { company: { select: { id: true, name: true } } },
        },
        sideTaskConfig: true,
      },
    });

    // Attach plan stats per session
    const sessionsWithSideTask = await Promise.all(
      sessions.map(async (session) => {
        const plans = await this.prisma.sideTaskPlan.findMany({
          where: { sessionId: session.id },
          select: {
            segmentIndex: true,
            isArchivedAtSegmentEnd: true,
            releasedAt: true,
            exposureLogs: {
              where: { eventType: 'side_task_answered' },
              select: { id: true },
              take: 1,
            },
          },
        });

        const segmentMap = new Map<number, { total: number; released: number; answered: number; archived: number }>();
        for (const plan of plans) {
          const existing = segmentMap.get(plan.segmentIndex) ?? { total: 0, released: 0, answered: 0, archived: 0 };
          existing.total++;
          if (plan.releasedAt) existing.released++;
          if (plan.exposureLogs.length > 0) existing.answered++;
          if (plan.isArchivedAtSegmentEnd && plan.exposureLogs.length === 0) existing.archived++;
          segmentMap.set(plan.segmentIndex, existing);
        }

        const planStats = Array.from(segmentMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([segmentIndex, stats]) => ({ segmentIndex, ...stats }));

        return { ...session, planStats };
      }),
    );

    return { ok: true, sessions: sessionsWithSideTask };
  }

  async exportData() {
    const sessions = await this.prisma.session.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        pairings: {
          include: {
            participantA: { select: { id: true, phone: true, role: true } },
            participantB: { select: { id: true, phone: true, role: true } },
          },
        },
        segmentStates: { orderBy: { segmentIndex: 'asc' } },
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: { company: true, snapshots: { orderBy: { createdAt: 'asc' } } },
        },
        progresses: {
          orderBy: { createdAt: 'asc' },
          include: { participant: { select: { id: true, phone: true, role: true } } },
        },
        snapshots: {
          orderBy: { createdAt: 'asc' },
        },
        sideTaskConfig: true,
        randomizationAudit: true,
        aiMessages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const companies = await this.prisma.company.findMany({ orderBy: { sortOrder: 'asc' } });
    return {
      ok: true,
      exportedAt: new Date().toISOString(),
      companies: companies.map((company) => this.serializeCompany(company)),
      sessions,
    };
  }

  private tryParseResearchProfile(companyId: string, material: StoredMaterialItem) {
    if (material.kind !== 'txt') return null;
    const filePath = storagePath('materials', companyId, material.storageKey);
    const raw = readUtf8File(filePath);
    return parseResearchProfileFromText(raw);
  }

  private buildLibraryCompanyId(caseCode: string, usage: string = 'formal') {
    const normalized = caseCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const usageKey = usage === 'practice' ? 'practice' : 'formal';
    return `company-library-${usageKey}-${normalized || 'case'}`;
  }

  private serializeCompany(company: {
    id: string;
    name: string;
    roundLabel: string;
    sector: string;
    usage?: string;
    tags: unknown;
    summary: string;
    materials: unknown;
    researchProfile?: unknown;
    autoFillSourceMaterialId?: string | null;
    sortOrder: number;
  }, fallbackCompany?: {
    id: string;
    materials: unknown;
    researchProfile?: unknown;
    autoFillSourceMaterialId?: string | null;
  } | null) {
    const usingFallback = !this.isUsableCompany(company) && fallbackCompany && this.isUsableCompany(fallbackCompany);
    const sourceCompany = usingFallback ? fallbackCompany : company;
    const materials = normalizeMaterials(sourceCompany.materials).map((item) => ({
      ...item,
      url: buildMaterialPublicUrl(sourceCompany.id, item.storageKey),
    }));
    return {
      id: company.id,
      name: company.name,
      roundLabel: company.roundLabel,
      sector: company.sector,
      usage: company.usage ?? 'formal',
      tags: Array.isArray(company.tags) ? company.tags : [],
      summary: company.summary,
      materials,
      researchProfile: usingFallback ? sourceCompany.researchProfile ?? null : company.researchProfile ?? null,
      autoFillSourceMaterialId: usingFallback
        ? sourceCompany.autoFillSourceMaterialId ?? null
        : company.autoFillSourceMaterialId ?? null,
      sortOrder: company.sortOrder,
    };
  }

  private normalizeAiLevels(levels: string[]) {
    const normalize = (value?: string) =>
      value?.toUpperCase() === 'ADVANCED' ? AiLevel.ADVANCED : AiLevel.BASIC;

    return [
      normalize(levels?.[0]),
      normalize(levels?.[1]),
      normalize(levels?.[2]),
    ] as const;
  }

  private validateBatchSizes(raw: string): string {
    const parts = raw.split(',').map((s) => Number(s.trim()));
    if (parts.some((n) => isNaN(n) || n < 1 || !Number.isInteger(n))) {
      throw new BadRequestException('batchSizes 必须是逗号分隔的正整数');
    }
    const sum = parts.reduce((a, b) => a + b, 0);
    if (sum !== 40) {
      throw new BadRequestException(`batchSizes 总和必须等于 40，当前为 ${sum}`);
    }
    return parts.join(',');
  }

  private async ensureExperimentConfig() {
    let config = await this.prisma.experimentConfig.findUnique({
      where: { id: 'default' },
      include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
    });

    if (!config) {
      const template = await this.ensureDefaultTemplate();
      const practiceTemplate = await this.ensureDefaultPracticeQuizTemplate();
      config = await this.prisma.experimentConfig.create({
        data: {
          id: 'default',
          activeExperimentMode: 'manual',
          experimentModeSettings: DEFAULT_EXPERIMENT_MODE_SETTINGS as Prisma.InputJsonValue,
          instructionBlocks: DEFAULT_INSTRUCTION_BLOCKS as Prisma.InputJsonValue,
          practiceDurationMinutes: 10,
          workDurationMinutes: 20,
          breakDurationMinutes: 5,
          segmentOneAiLevel: AiLevel.BASIC,
          segmentTwoAiLevel: AiLevel.ADVANCED,
          segmentThreeAiLevel: AiLevel.ADVANCED,
          activeQuestionnaireTemplateId: template.id,
          practiceQuizTemplateId: practiceTemplate.id,
          practiceQuizPassCount: 0,
        },
        include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
      });
    } else if (!config.practiceQuizTemplateId) {
      const practiceTemplate = await this.ensureDefaultPracticeQuizTemplate();
      config = await this.prisma.experimentConfig.update({
        where: { id: config.id },
        data: {
          practiceDurationMinutes: config.practiceDurationMinutes || 10,
          practiceQuizTemplateId: practiceTemplate.id,
          practiceQuizPassCount: config.practiceQuizPassCount || 0,
        },
        include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
      });
    } else if (config.activeQuestionnaireTemplateId !== FORMAL_QUESTIONNAIRE_TEMPLATE_ID) {
      const template = await this.ensureDefaultTemplate();
      config = await this.prisma.experimentConfig.update({
        where: { id: config.id },
        data: {
          activeQuestionnaireTemplateId: template.id,
        },
        include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
      });
    } else if (
      config.activeQuestionnaireTemplate?.title.includes('?') ||
      !this.hasFormalQuestionnaireShape(config.activeQuestionnaireTemplate?.items)
    ) {
      await this.ensureDefaultTemplate();
      const refreshed = await this.prisma.experimentConfig.findUnique({
        where: { id: 'default' },
        include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
      });
      if (refreshed) config = refreshed;
    }

    return config;
  }

  private hasFormalQuestionnaireShape(value: unknown) {
    return Boolean(
      value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>).segmentSurvey &&
        (value as Record<string, unknown>).postSurvey,
    );
  }

  private normalizeExperimentMode(value?: string): ExperimentMode {
    const next = String(value ?? 'manual') as ExperimentMode;
    return EXPERIMENT_MODES.has(next) ? next : 'manual';
  }

  private normalizeAiLevel(value?: unknown) {
    return String(value ?? 'BASIC').toUpperCase() === 'ADVANCED' ? 'ADVANCED' : 'BASIC';
  }

  private normalizeDispatchMode(value?: unknown) {
    return String(value ?? 'continuous') === 'batch' ? 'batch' : 'continuous';
  }

  private normalizeNarrativeGroup(value?: unknown) {
    return String(value ?? 'neutral_info') === 'coop_narrative' ? 'coop_narrative' : 'neutral_info';
  }

  private normalizeExperimentModeSettings(value: unknown) {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const aiUpgrade = raw.ai_upgrade && typeof raw.ai_upgrade === 'object'
      ? raw.ai_upgrade as Record<string, unknown>
      : {};
    const sideReminder = raw.side_reminder && typeof raw.side_reminder === 'object'
      ? raw.side_reminder as Record<string, unknown>
      : {};
    const coopNarrative = raw.coop_narrative && typeof raw.coop_narrative === 'object'
      ? raw.coop_narrative as Record<string, unknown>
      : {};

    return {
      ai_upgrade: {
        fixedSideDispatchMode: this.normalizeDispatchMode(
          aiUpgrade.fixedSideDispatchMode ?? DEFAULT_EXPERIMENT_MODE_SETTINGS.ai_upgrade.fixedSideDispatchMode,
        ),
        fixedNarrativeGroup: this.normalizeNarrativeGroup(
          aiUpgrade.fixedNarrativeGroup ?? DEFAULT_EXPERIMENT_MODE_SETTINGS.ai_upgrade.fixedNarrativeGroup,
        ),
      },
      side_reminder: {
        fixedAiLevel: this.normalizeAiLevel(
          sideReminder.fixedAiLevel ?? DEFAULT_EXPERIMENT_MODE_SETTINGS.side_reminder.fixedAiLevel,
        ),
        fixedNarrativeGroup: this.normalizeNarrativeGroup(
          sideReminder.fixedNarrativeGroup ?? DEFAULT_EXPERIMENT_MODE_SETTINGS.side_reminder.fixedNarrativeGroup,
        ),
      },
      coop_narrative: {
        fixedAiLevel: this.normalizeAiLevel(
          coopNarrative.fixedAiLevel ?? DEFAULT_EXPERIMENT_MODE_SETTINGS.coop_narrative.fixedAiLevel,
        ),
        fixedSideDispatchMode: this.normalizeDispatchMode(
          coopNarrative.fixedSideDispatchMode ?? DEFAULT_EXPERIMENT_MODE_SETTINGS.coop_narrative.fixedSideDispatchMode,
        ),
      },
    };
  }

  private normalizeInstructionBlocks(value: unknown) {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(
      Object.entries(DEFAULT_INSTRUCTION_BLOCKS).map(([key, fallback]) => [
        key,
        typeof raw[key] === 'string' ? String(raw[key]) : fallback,
      ]),
    );
  }

  private async ensureBaselineCompanyIfMissing() {
    const companies = await this.prisma.company.findMany();
    const hasUsableCompany = companies.some((company) => this.isUsableCompany(company));
    if (hasUsableCompany) return;
    await this.importBaselineP01();
  }

  private isUsableCompany(company: {
    materials: unknown;
    autoFillSourceMaterialId?: string | null;
  }) {
    const materials = normalizeMaterials(company.materials);
    if (materials.length === 0) return false;
    const allStored = materials.every((item) => Boolean(item.storageKey));
    if (!allStored) return false;
    if (!company.autoFillSourceMaterialId) return true;
    return materials.some((item) => item.id === company.autoFillSourceMaterialId);
  }

  async getAiSettings() {
    let settings = await this.prisma.aiSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await this.prisma.aiSettings.create({ data: { id: 'default' } });
    }
    return {
      ok: true,
      settings: {
        basicBaseUrl: settings.basicBaseUrl,
        basicModel: settings.basicModel,
        basicApiKey: settings.basicApiKey ? '••••' + settings.basicApiKey.slice(-4) : '',
        basicContextLimit: settings.basicContextLimit,
        advancedBaseUrl: settings.advancedBaseUrl,
        advancedModel: settings.advancedModel,
        advancedApiKey: settings.advancedApiKey ? '••••' + settings.advancedApiKey.slice(-4) : '',
        advancedContextLimit: settings.advancedContextLimit,
        basicDisplayName: settings.basicDisplayName || 'aiseek',
        advancedDisplayName: settings.advancedDisplayName || 'aiseek pro',
        systemPromptMain: settings.systemPromptMain || '',
        systemPromptSide: settings.systemPromptSide || '',
      },
    };
  }

  async saveAiSettings(input: {
    basicBaseUrl?: string;
    basicModel?: string;
    basicApiKey?: string;
    basicContextLimit?: number;
    advancedBaseUrl?: string;
    advancedModel?: string;
    advancedApiKey?: string;
    advancedContextLimit?: number;
    basicDisplayName?: string;
    advancedDisplayName?: string;
    systemPromptMain?: string;
    systemPromptSide?: string;
  }) {
    const existing = await this.prisma.aiSettings.findUnique({ where: { id: 'default' } });
    const data: Record<string, unknown> = {};
    if (input.basicBaseUrl !== undefined) data.basicBaseUrl = input.basicBaseUrl;
    if (input.basicModel !== undefined) data.basicModel = input.basicModel;
    if (input.basicContextLimit !== undefined) data.basicContextLimit = Math.max(1, Number(input.basicContextLimit) || 20);
    if (input.advancedBaseUrl !== undefined) data.advancedBaseUrl = input.advancedBaseUrl;
    if (input.advancedModel !== undefined) data.advancedModel = input.advancedModel;
    if (input.advancedContextLimit !== undefined) data.advancedContextLimit = Math.max(1, Number(input.advancedContextLimit) || 20);
    if (input.basicDisplayName !== undefined) data.basicDisplayName = input.basicDisplayName.trim() || 'aiseek';
    if (input.advancedDisplayName !== undefined) data.advancedDisplayName = input.advancedDisplayName.trim() || 'aiseek pro';

    // API Key: only update if provided and not the masked placeholder
    if (input.basicApiKey !== undefined && !input.basicApiKey.startsWith('••••')) {
      data.basicApiKey = input.basicApiKey;
    }
    if (input.advancedApiKey !== undefined && !input.advancedApiKey.startsWith('••••')) {
      data.advancedApiKey = input.advancedApiKey;
    }

    // System prompts: save as-is
    if (input.systemPromptMain !== undefined) data.systemPromptMain = input.systemPromptMain;
    if (input.systemPromptSide !== undefined) data.systemPromptSide = input.systemPromptSide;

    const settings = existing
      ? await this.prisma.aiSettings.update({ where: { id: 'default' }, data })
      : await this.prisma.aiSettings.create({ data: { id: 'default', ...data } });

    return { ok: true, settings };
  }

  private async ensureDefaultTemplate(): Promise<QuestionnaireTemplate> {
    return this.prisma.questionnaireTemplate.upsert({
      where: { id: FORMAL_QUESTIONNAIRE_TEMPLATE_ID },
      update: {
        title: '\u4e09\u7ae0\u5b9e\u9a8c\u6b63\u5f0f\u95ee\u5377 V1.1',
        items: formalQuestionnaireTemplateJson(),
        isActive: true,
      },
      create: {
        id: FORMAL_QUESTIONNAIRE_TEMPLATE_ID,
        title: '\u4e09\u7ae0\u5b9e\u9a8c\u6b63\u5f0f\u95ee\u5377 V1.1',
        isActive: true,
        items: formalQuestionnaireTemplateJson(),
      },
    });
  }

  private normalizeFormalQuestionnaireTemplate(value: FormalQuestionnaireInput): Prisma.InputJsonValue {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const row = value as Record<string, unknown>;
      if (row.schemaVersion && row.segmentSurvey && row.postSurvey) {
        return row as Prisma.InputJsonValue;
      }
    }
    return formalQuestionnaireTemplateJson();
  }

  private async ensureDefaultPracticeQuizTemplate(): Promise<QuestionnaireTemplate> {
    return this.prisma.questionnaireTemplate.upsert({
      where: { id: 'default-practice-quiz' },
      update: {
        isActive: true,
      },
      create: {
        id: 'default-practice-quiz',
        title: '\u6d4b\u8bd5\u8f6e\u5f00\u59cb\u524d\u6d4b\u8bd5\u9898',
        isActive: true,
        items: [
          {
            id: 'pq1',
            prompt: '\u5c3d\u8c03\u5458\u5728\u5355\u5bb6\u516c\u53f8\u7684 5 \u5206\u949f\u65f6\u95f4\u5230\u540e\uff0c\u7cfb\u7edf\u4f1a\u5982\u4f55\u5904\u7406\uff1f',
            options: [
              '\u81ea\u52a8\u63d0\u4ea4\uff0c\u5e76\u5c06\u4fe1\u606f\u89e3\u9501\u7ed9\u6295\u8d44\u7ecf\u7406',
              '\u7ee7\u7eed\u4f5c\u7b54\uff0c\u76f4\u5230\u624b\u52a8\u63d0\u4ea4',
            ],
            correctOption: '\u81ea\u52a8\u63d0\u4ea4\uff0c\u5e76\u5c06\u4fe1\u606f\u89e3\u9501\u7ed9\u6295\u8d44\u7ecf\u7406',
          },
          {
            id: 'pq2',
            prompt: '\u6295\u8d44\u7ecf\u7406\u5728\u5c3d\u8c03\u4fe1\u606f\u89e3\u9501\u4e4b\u524d\uff0c\u662f\u5426\u53ef\u4ee5\u5148\u67e5\u770b\u81ea\u5df1\u7684\u6750\u6599\u5e76\u5199\u8349\u7a3f\uff1f',
            options: ['\u53ef\u4ee5', '\u4e0d\u53ef\u4ee5'],
            correctOption: '\u53ef\u4ee5',
          },
        ] as Prisma.InputJsonValue,
      },
    });
  }
}
