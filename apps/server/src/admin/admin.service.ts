import { AiLevel, Prisma, QuestionnaireTemplate } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { basename, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CASE_LIBRARY_ROOT,
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

type CompanyWithMaterials = {
  id: string;
  name: string;
  roundLabel: string;
  sector: string;
  tags: Prisma.JsonValue;
  summary: string;
  materials: Prisma.JsonValue;
  researchProfile: Prisma.JsonValue | null;
  autoFillSourceMaterialId: string | null;
  sortOrder: number;
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

  async getExperimentConfig() {
    const config = await this.ensureExperimentConfig();
    return {
      ok: true,
      config: {
        id: config.id,
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
      },
    };
  }

  async saveExperimentConfig(input: {
    workDurationMinutes: number;
    breakDurationMinutes: number;
    segmentAiLevels: string[];
    questionnaireTitle?: string;
    questionnaireItems: { id?: string; prompt: string; options: string[] }[];
  }) {
    const cleanItems = (input.questionnaireItems ?? [])
      .map((item, index) => ({
        id: item.id?.trim() || `q${index + 1}`,
        prompt: item.prompt?.trim() || '',
        options: (item.options ?? []).map((option) => option.trim()).filter(Boolean),
      }))
      .filter((item) => item.prompt && item.options.length >= 2);

    const template = await this.prisma.questionnaireTemplate.upsert({
      where: { id: 'default-break-questionnaire' },
      update: {
        title: input.questionnaireTitle?.trim() || '默认休息问卷',
        items: cleanItems as Prisma.InputJsonValue,
        isActive: true,
      },
      create: {
        id: 'default-break-questionnaire',
        title: input.questionnaireTitle?.trim() || '默认休息问卷',
        items: cleanItems as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    const [segmentOneAiLevel, segmentTwoAiLevel, segmentThreeAiLevel] =
      this.normalizeAiLevels(input.segmentAiLevels);

    const config = await this.prisma.experimentConfig.upsert({
      where: { id: 'default' },
      update: {
        workDurationMinutes: Math.max(1, Number(input.workDurationMinutes) || 20),
        breakDurationMinutes: Math.max(1, Number(input.breakDurationMinutes) || 5),
        segmentOneAiLevel,
        segmentTwoAiLevel,
        segmentThreeAiLevel,
        activeQuestionnaireTemplateId: template.id,
      },
      create: {
        id: 'default',
        workDurationMinutes: Math.max(1, Number(input.workDurationMinutes) || 20),
        breakDurationMinutes: Math.max(1, Number(input.breakDurationMinutes) || 5),
        segmentOneAiLevel,
        segmentTwoAiLevel,
        segmentThreeAiLevel,
        activeQuestionnaireTemplateId: template.id,
      },
      include: { activeQuestionnaireTemplate: true },
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
      cases: cases.map((item) => ({
        folderName: item.folderName,
        caseCode: item.caseCode,
        companyName: item.companyName,
        sector: item.sector,
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
      const companyId = this.buildLibraryCompanyId(definition.caseCode);
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
      const materials: StoredMaterialItem[] = allMaterials.map((file, index) =>
        createStoredMaterialItem({
          companyId,
          originalFilename: file.displayName,
          displayName: file.displayName,
          sourcePath: file.fullPath,
          sortOrder: index,
          metadata: {
            audience: participantPaths.has(file.relativePath) ? 'participant' : 'research',
            participantRole: participantRoleByPath.get(file.relativePath) ?? 'shared',
            importRelativePath: file.relativePath,
            importFolderName: definition.folderName,
            importedFromLibrary: true,
          },
        }),
      );

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
    };
  }

  async initSessionTasks(sessionCode: string) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) return { ok: false, error: 'session not found' };
    await this.prisma.taskAssignment.deleteMany({ where: { sessionId: session.id } });

    await this.ensureBaselineCompanyIfMissing();
    const companies = (await this.prisma.company.findMany({ orderBy: { sortOrder: 'asc' } })).filter((company) =>
      this.isUsableCompany(company),
    );
    if (companies.length === 0) {
      throw new BadRequestException('No usable companies with uploaded materials are available');
    }
    const shuffled = [...companies].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      await this.prisma.taskAssignment.create({
        data: {
          sessionId: session.id,
          companyId: shuffled[i].id,
          sortOrder: i + 1,
          sequenceIndex: i + 1,
        },
      });
    }
    return { ok: true, tasksCreated: shuffled.length };
  }

  async clearSessions() {
    await this.prisma.taskProgress.deleteMany({});
    await this.prisma.taskSnapshot.deleteMany({});
    await this.prisma.taskAssignment.deleteMany({});
    await this.prisma.questionnaireResponse.deleteMany({});
    await this.prisma.pairing.deleteMany({});
    await this.prisma.session.deleteMany({});
    await this.prisma.participant.updateMany({ data: { role: null } });
    return {
      ok: true,
      message: '已清空全部实验运行数据，并重置参与者临时角色字段',
    };
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
      },
    });
    return { ok: true, sessions };
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
    const filePath = join(process.cwd(), 'storage', 'materials', companyId, material.storageKey);
    const raw = readUtf8File(filePath);
    return parseResearchProfileFromText(raw);
  }

  private buildLibraryCompanyId(caseCode: string) {
    const normalized = caseCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `company-library-${normalized || 'case'}`;
  }

  private serializeCompany(company: {
    id: string;
    name: string;
    roundLabel: string;
    sector: string;
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

  private async ensureExperimentConfig() {
    let config = await this.prisma.experimentConfig.findUnique({
      where: { id: 'default' },
      include: { activeQuestionnaireTemplate: true },
    });

    if (!config) {
      const template = await this.ensureDefaultTemplate();
      config = await this.prisma.experimentConfig.create({
        data: {
          id: 'default',
          workDurationMinutes: 20,
          breakDurationMinutes: 5,
          segmentOneAiLevel: AiLevel.BASIC,
          segmentTwoAiLevel: AiLevel.ADVANCED,
          segmentThreeAiLevel: AiLevel.ADVANCED,
          activeQuestionnaireTemplateId: template.id,
        },
        include: { activeQuestionnaireTemplate: true },
      });
    }

    return config;
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
  }) {
    const existing = await this.prisma.aiSettings.findUnique({ where: { id: 'default' } });
    const data: Record<string, unknown> = {};
    if (input.basicBaseUrl !== undefined) data.basicBaseUrl = input.basicBaseUrl;
    if (input.basicModel !== undefined) data.basicModel = input.basicModel;
    if (input.basicContextLimit !== undefined) data.basicContextLimit = Math.max(1, Number(input.basicContextLimit) || 20);
    if (input.advancedBaseUrl !== undefined) data.advancedBaseUrl = input.advancedBaseUrl;
    if (input.advancedModel !== undefined) data.advancedModel = input.advancedModel;
    if (input.advancedContextLimit !== undefined) data.advancedContextLimit = Math.max(1, Number(input.advancedContextLimit) || 20);

    // API Key: only update if provided and not the masked placeholder
    if (input.basicApiKey !== undefined && !input.basicApiKey.startsWith('••••')) {
      data.basicApiKey = input.basicApiKey;
    }
    if (input.advancedApiKey !== undefined && !input.advancedApiKey.startsWith('••••')) {
      data.advancedApiKey = input.advancedApiKey;
    }

    const settings = existing
      ? await this.prisma.aiSettings.update({ where: { id: 'default' }, data })
      : await this.prisma.aiSettings.create({ data: { id: 'default', ...data } });

    return { ok: true, settings };
  }

  private async ensureDefaultTemplate(): Promise<QuestionnaireTemplate> {
    return this.prisma.questionnaireTemplate.upsert({
      where: { id: 'default-break-questionnaire' },
      update: {
        isActive: true,
      },
      create: {
        id: 'default-break-questionnaire',
        title: '默认休息问卷',
        isActive: true,
        items: [
          {
            id: 'q1',
            prompt: '你当前的认知负荷感受如何？',
            options: ['很低', '较低', '中等', '较高', '很高'],
          },
        ] as Prisma.InputJsonValue,
      },
    });
  }
}
