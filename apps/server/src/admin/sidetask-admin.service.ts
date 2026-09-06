import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SideTaskAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async importExcel(filePath: string) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = ['正式题库', '题库'].find((name) => workbook.Sheets[name]);
    if (!sheetName) {
      throw new BadRequestException('Excel 中未找到名为“正式题库”或“题库”的 sheet');
    }
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (matrix.length < 2) {
      throw new BadRequestException('题库 sheet 为空');
    }
    const headers = matrix[0].map((value) => this.normalizeHeader(value));
    const requiredHeaders = ['item_id', 'work_segment', 'text', 'question', 'option_a', 'option_b', 'gold_answer', 'pool_type', 'narrative_category', 'content_subtype'];
    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
    if (missingHeaders.length > 0) {
      throw new BadRequestException(`题库缺少必要字段：${missingHeaders.join(', ')}`);
    }
    const rows = matrix.slice(1)
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])) as Record<string, unknown>)
      .filter((row) => Object.values(row).some((value) => String(value ?? '').trim()));
    if (rows.length === 0) throw new BadRequestException('题库 sheet 为空');

    const detectedVersion = this.detectWorkbookVersion(workbook) ?? 'imported';
    const parsed = rows.map((row, index) => this.parseImportRow(row, index + 2, detectedVersion));
    this.validateImportRows(parsed);

    const importedItemCodes = parsed.map((item) => item.itemCode);
    const existing = await this.prisma.sideTaskItem.findMany({
      where: { itemCode: { in: importedItemCodes } },
      select: { itemCode: true },
    });
    const existingCodes = new Set(existing.map((item) => item.itemCode));
    const created = importedItemCodes.filter((code) => !existingCodes.has(code)).length;
    const updated = importedItemCodes.length - created;

    const deactivated = await this.prisma.$transaction(async (tx) => {
      for (const item of parsed) {
        const { itemCode, ...data } = item;
        await tx.sideTaskItem.upsert({
          where: { itemCode },
          update: data,
          create: { itemCode, ...data },
        });
      }
      return tx.sideTaskItem.updateMany({
          where: {
            itemCode: { notIn: importedItemCodes },
            isActive: true,
          },
          data: { isActive: false },
        });
    }, { timeout: 120_000 });

    return { ok: true, sheetName, version: detectedVersion, total: parsed.length, created, updated, deactivated: deactivated.count };
  }

  private normalizeHeader(value: unknown) {
    const lines = String(value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return (lines.at(-1) ?? '').toLowerCase();
  }

  private detectWorkbookVersion(workbook: XLSX.WorkBook) {
    const summary = workbook.Sheets['结论及修改清单'];
    const firstCell = summary?.A1?.v;
    return String(firstCell ?? '').match(/V\d+(?:\.\d+)*/i)?.[0] ?? null;
  }

  private parseImportRow(row: Record<string, unknown>, rowNumber: number, detectedVersion: string) {
    const itemCode = String(row['item_id'] ?? '').trim();
    const workSegment = Number(row['work_segment']);
    const directAiRaw = String(row['direct_ai_flag'] ?? '').trim().toLowerCase();
    const spilloverRaw = String(row['spillover_risk_flag'] ?? '').trim();
    if (!itemCode) throw new BadRequestException(`题库第 ${rowNumber} 行缺少 item_id`);
    return {
      itemCode,
      poolType: String(row['pool_type'] ?? '').trim(),
      workSegment,
      eventArchetype: this.toNullable(row['event_archetype'] ?? row['content_theme']),
      eventChain: this.toNullable(row['event_chain']),
      surfaceScenario: this.toNullable(row['surface_scenario'] ?? row['business_scenario']),
      languageVariant: this.toNullable(row['language_variant'] ?? row['text_form']),
      skeletonType: this.toNullable(row['skeleton_type'] ?? row['question_type']),
      narrativeCategory: this.toNullable(row['narrative_category']),
      narrativeSubtype: this.toNullable(row['narrative_subtype'] ?? row['content_subtype']),
      directAiFlag: directAiRaw === '是' || directAiRaw === '1' || directAiRaw === 'true',
      text: String(row['text'] ?? '').trim(),
      question: String(row['question'] ?? '').trim(),
      questionVariantId: this.toNullable(row['question_variant_id']),
      optionA: String(row['option_a'] ?? '').trim(),
      optionB: String(row['option_b'] ?? '').trim(),
      goldAnswer: this.toNullable(row['gold_answer']),
      evidenceSpan: this.toNullable(row['evidence_span']),
      distractorType: this.toNullable(row['distractor_type']),
      distractorNote: this.toNullable(row['distractor_note']),
      narrativeComponents: this.toNullable(row['narrative_components'] ?? row['content_theme']),
      spilloverRiskFlag: spilloverRaw !== 'PASS' && spilloverRaw !== '',
      spilloverRiskNote: this.toNullable(row['spillover_risk_note']),
      difficulty: this.toNullable(row['difficulty']),
      version: this.toNullable(row['version']) ?? detectedVersion,
      isActive: true,
    } satisfies Prisma.SideTaskItemCreateInput;
  }

  private validateImportRows(rows: Array<Prisma.SideTaskItemCreateInput & { itemCode: string }>) {
    const codes = new Set<string>();
    for (const item of rows) {
      if (codes.has(item.itemCode)) throw new BadRequestException(`题库存在重复 item_id：${item.itemCode}`);
      codes.add(item.itemCode);
      if (![1, 2, 3].includes(item.workSegment)) throw new BadRequestException(`${item.itemCode} 的 work_segment 必须为 1、2 或 3`);
      if (!['普通中性池', '合作叙事池'].includes(item.poolType)) throw new BadRequestException(`${item.itemCode} 的 pool_type 无效`);
      if (!item.text || !item.question || !item.optionA || !item.optionB) throw new BadRequestException(`${item.itemCode} 的正文、题干或选项不完整`);
      if (!['A', 'B'].includes(item.goldAnswer ?? '')) throw new BadRequestException(`${item.itemCode} 的 gold_answer 必须为 A 或 B`);
    }
    for (const segment of [1, 2, 3]) {
      const neutralCount = rows.filter((item) => item.workSegment === segment && item.poolType === '普通中性池').length;
      if (neutralCount < 40) throw new BadRequestException(`工作段 ${segment} 普通中性池不足 40 题`);
      for (const [theme, prefix] of [['互补分工', 'C'], ['验证留痕', 'V'], ['共同责任', 'S']] as const) {
        for (let subtype = 1; subtype <= 5; subtype += 1) {
          const count = rows.filter((item) => item.workSegment === segment
            && item.poolType === '合作叙事池'
            && item.narrativeCategory === theme
            && item.narrativeSubtype?.startsWith(`${prefix}${subtype}_`)).length;
          if (count < 4) throw new BadRequestException(`工作段 ${segment} 的 ${theme}/${prefix}${subtype} 候选题不足 4 题`);
        }
      }
    }
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
