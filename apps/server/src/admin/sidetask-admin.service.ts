import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SideTaskAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async importExcel(filePath: string) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = '正式题库';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new BadRequestException(`Excel 中未找到名为"${sheetName}"的 sheet`);
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (rows.length === 0) {
      throw new BadRequestException('题库 sheet 为空');
    }

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const itemCode = String(row['item_id'] ?? '').trim();
      if (!itemCode) continue;

      const poolType = String(row['pool_type'] ?? '').trim();
      const workSegment = Number(row['work_segment']);
      const directAiRaw = String(row['direct_ai_flag'] ?? '').trim();
      const directAiFlag = directAiRaw === '是' || directAiRaw === '1' || directAiRaw.toLowerCase() === 'true';
      const spilloverRaw = String(row['spillover_risk_flag'] ?? '').trim();
      const spilloverRiskFlag = spilloverRaw !== 'PASS' && spilloverRaw !== '';

      const data: Prisma.SideTaskItemCreateInput = {
        itemCode,
        poolType,
        workSegment: isNaN(workSegment) ? 1 : workSegment,
        surfaceScenario: this.toNullable(row['surface_scenario']),
        skeletonType: this.toNullable(row['skeleton_type']),
        narrativeCategory: this.toNullable(row['narrative_category']),
        narrativeSubtype: this.toNullable(row['narrative_subtype']),
        directAiFlag,
        text: String(row['text'] ?? ''),
        question: String(row['question'] ?? ''),
        questionVariantId: this.toNullable(row['question_variant_id']),
        optionA: String(row['option_a'] ?? ''),
        optionB: String(row['option_b'] ?? ''),
        goldAnswer: this.toNullable(row['gold_answer']),
        evidenceSpan: this.toNullable(row['evidence_span']),
        distractorType: this.toNullable(row['distractor_type']),
        distractorNote: this.toNullable(row['distractor_note']),
        spilloverRiskFlag,
        spilloverRiskNote: this.toNullable(row['spillover_risk_note']),
        difficulty: this.toNullable(row['difficulty']),
        version: this.toNullable(row['version']),
        isActive: true,
      };

      const existing = await this.prisma.sideTaskItem.findUnique({
        where: { itemCode },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.sideTaskItem.update({
          where: { itemCode },
          data,
        });
        updated++;
      } else {
        await this.prisma.sideTaskItem.create({ data });
        created++;
      }
    }

    return { ok: true, total: rows.length, created, updated };
  }

  async listItems(filters: {
    poolType?: string;
    workSegment?: number;
    narrativeCategory?: string;
    directAiFlag?: boolean;
    version?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const where: Prisma.SideTaskItemWhereInput = {};
    if (filters.poolType) where.poolType = filters.poolType;
    if (filters.workSegment) where.workSegment = filters.workSegment;
    if (filters.narrativeCategory) where.narrativeCategory = filters.narrativeCategory;
    if (filters.directAiFlag !== undefined) where.directAiFlag = filters.directAiFlag;
    if (filters.version) where.version = filters.version;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

    const [items, total] = await Promise.all([
      this.prisma.sideTaskItem.findMany({
        where,
        orderBy: { itemCode: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sideTaskItem.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getStats() {
    const items = await this.prisma.sideTaskItem.findMany({
      where: { isActive: true },
      select: { poolType: true, workSegment: true, narrativeCategory: true, directAiFlag: true },
    });

    const byPool: Record<string, number> = {};
    const bySegment: Record<number, number> = {};
    const byCategory: Record<string, number> = {};
    let directAiCount = 0;

    for (const item of items) {
      byPool[item.poolType] = (byPool[item.poolType] ?? 0) + 1;
      bySegment[item.workSegment] = (bySegment[item.workSegment] ?? 0) + 1;
      if (item.narrativeCategory) {
        byCategory[item.narrativeCategory] = (byCategory[item.narrativeCategory] ?? 0) + 1;
      }
      if (item.directAiFlag) directAiCount++;
    }

    return {
      total: items.length,
      byPool,
      bySegment,
      byCategory,
      directAiCount,
    };
  }

  async toggleActive(id: string) {
    const item = await this.prisma.sideTaskItem.findUnique({ where: { id } });
    if (!item) throw new BadRequestException('题目不存在');

    return this.prisma.sideTaskItem.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
  }

  private toNullable(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str || null;
  }
}
