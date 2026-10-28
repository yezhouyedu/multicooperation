import { BadRequestException, ConflictException } from '@nestjs/common';

export type DraftVersions = Record<string, { revision: number; mutationId?: string }>;

export function readDraftVersions(value: unknown): DraftVersions {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DraftVersions : {};
}

export function checkDraftVersion(value: unknown, section: string, expectedRevision?: number, mutationId?: string) {
  const versions = readDraftVersions(value);
  const current = versions[section]?.revision ?? 0;
  if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) throw new BadRequestException('草稿版本号无效');
  if (mutationId && versions[section]?.mutationId === mutationId) return { duplicate: true, revision: current, versions };
  if ((expectedRevision ?? 0) !== current) throw new ConflictException({ message: '草稿版本冲突：本地内容已保留，请勿清缓存，联系研究员处理', revision: current });
  const revision = current + 1;
  return { duplicate: false, revision, versions: { ...versions, [section]: { revision, ...(mutationId ? { mutationId } : {}) } } };
}
