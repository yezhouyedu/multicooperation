import { BadRequestException } from '@nestjs/common';

export function validateNumericAnswers(items: Array<{ code: string; type: string; required?: boolean; min?: number; max?: number }>, answers: Record<string, unknown>) {
  for (const item of items) {
    if (item.type !== 'number') continue;
    const value = answers[item.code];
    if (value === undefined || value === null || String(value).trim() === '') {
      if (item.required) throw new BadRequestException(`${item.code} 请填写数字`);
      continue;
    }
    if (!['string', 'number'].includes(typeof value)) throw new BadRequestException(`${item.code} 数字无效`);
    const number = Number(value);
    if (!Number.isFinite(number) || number < Math.max(0, item.min ?? 0) || (item.max !== undefined && number > item.max)) {
      throw new BadRequestException(`${item.code} 请输入符合范围的非负数字`);
    }
  }
}
