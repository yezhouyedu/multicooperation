import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { randomUUID } from 'crypto';
import { extname, join, relative, resolve } from 'path';

export type MaterialKind = 'txt' | 'docx' | 'pdf' | 'xlsx';
export type RenderMode = 'text' | 'docx-preview' | 'pdf' | 'spreadsheet';
export type ParseStatus = 'ready' | 'error';
export type MaterialAudience = 'participant' | 'research';
export type MaterialParticipantRole = 'A' | 'B' | 'shared';

export type StoredMaterialItem = {
  id: string;
  displayName: string;
  sourceFilename: string;
  kind: MaterialKind;
  storageKey: string;
  mimeType: string;
  sortOrder: number;
  renderMode: RenderMode;
  parseStatus: ParseStatus;
  parseError: string | null;
  metadata: Record<string, unknown>;
};

export type ResearchProfile = {
  companyCode: string;
  companyName: string;
  industry: string;
  alias: string;
  businessSummary: string;
  aFacts: { index: number; label: string; value: string }[];
  rawText: string;
};

export type LibraryCaseDefinition = {
  folderName: string;
  folderPath: string;
  usage: 'formal' | 'practice';
  caseCode: string;
  companyName: string;
  roundLabel: string;
  sector: string;
  summary: string;
  tags: string[];
  sortOrder: number;
  participantMaterials: Array<{
    fullPath: string;
    relativePath: string;
    displayName: string;
    participantRole: MaterialParticipantRole;
  }>;
  researchMaterials: Array<{
    fullPath: string;
    relativePath: string;
    displayName: string;
  }>;
  autoFillSourceRelativePath: string | null;
};

type CaseManifest = {
  usage?: 'formal' | 'practice';
  caseCode?: string;
  companyName?: string;
  roundLabel?: string;
  sector?: string;
  summary?: string;
  tags?: string[];
  participantDir?: string;
  researchDir?: string;
  diligenceDir?: string;
  managerDir?: string;
  sharedDir?: string;
  autoFillSource?: string;
  sortOrder?: number;
};

export const MATERIALS_STORAGE_ROOT = resolve(process.cwd(), 'storage', 'materials');
export const CASE_LIBRARY_ROOT = resolve(process.cwd(), '..', '..', '00_start_materials', '原始材料');
export const FORMAL_CASE_LIBRARY_ROOT = resolve(CASE_LIBRARY_ROOT, '正式');
export const PRACTICE_CASE_LIBRARY_ROOT = resolve(CASE_LIBRARY_ROOT, '测试轮');
const BASELINE_P01_DIR = resolve(CASE_LIBRARY_ROOT, 'P01');

export function ensureMaterialsStorageRoot() {
  mkdirSync(MATERIALS_STORAGE_ROOT, { recursive: true });
}

export function ensureCompanyStorageDir(companyId: string) {
  const dir = join(MATERIALS_STORAGE_ROOT, companyId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function buildMaterialPublicUrl(companyId: string, storageKey: string) {
  return `/uploads/materials/${companyId}/${storageKey}`;
}

export function inferMaterialKind(filename: string): MaterialKind | null {
  const ext = extname(filename).toLowerCase();
  if (ext === '.txt') return 'txt';
  if (ext === '.docx') return 'docx';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.xlsx' || ext === '.xls') return 'xlsx';
  return null;
}

export function inferRenderMode(kind: MaterialKind): RenderMode {
  if (kind === 'txt') return 'text';
  if (kind === 'docx') return 'docx-preview';
  if (kind === 'pdf') return 'pdf';
  return 'spreadsheet';
}

export function inferMimeType(kind: MaterialKind) {
  switch (kind) {
    case 'txt':
      return 'text/plain';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
}

export function sanitizeFilenamePart(value: string) {
  return value.replace(/[^\w\-.()\u4e00-\u9fa5]+/g, '_');
}

export function createStoredMaterialItem(input: {
  companyId: string;
  originalFilename: string;
  sourcePath: string;
  sortOrder: number;
  displayName?: string;
  metadata?: Record<string, unknown>;
}) {
  const kind = inferMaterialKind(input.originalFilename);
  if (!kind) throw new Error(`Unsupported file type: ${input.originalFilename}`);
  const ext = extname(input.originalFilename).toLowerCase();
  const storageKey = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const companyDir = ensureCompanyStorageDir(input.companyId);
  const targetPath = join(companyDir, storageKey);
  copyFileSync(input.sourcePath, targetPath);

  return {
    id: randomUUID(),
    displayName: input.displayName ?? input.originalFilename,
    sourceFilename: input.originalFilename,
    kind,
    storageKey,
    mimeType: inferMimeType(kind),
    sortOrder: input.sortOrder,
    renderMode: inferRenderMode(kind),
    parseStatus: 'ready',
    parseError: null,
    metadata: {
      size: statSync(targetPath).size,
      uploadedAt: new Date().toISOString(),
      ...(input.metadata ?? {}),
    },
  } satisfies StoredMaterialItem;
}

export function removeStoredMaterial(companyId: string, storageKey?: string) {
  if (!storageKey) return;
  const targetPath = join(MATERIALS_STORAGE_ROOT, companyId, storageKey);
  if (existsSync(targetPath)) rmSync(targetPath, { force: true });
}

export function normalizeMaterials(value: unknown): StoredMaterialItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const kind = typeof row.kind === 'string' ? inferMaterialKind(`x.${row.kind}`) ?? row.kind : null;
      if (!kind || (kind !== 'txt' && kind !== 'docx' && kind !== 'pdf' && kind !== 'xlsx')) return null;
      return {
        id: String(row.id ?? randomUUID()),
        displayName: String(row.displayName ?? row.label ?? row.sourceFilename ?? `材料 ${index + 1}`),
        sourceFilename: String(row.sourceFilename ?? row.displayName ?? `材料-${index + 1}`),
        kind,
        storageKey: String(row.storageKey ?? ''),
        mimeType: String(row.mimeType ?? inferMimeType(kind)),
        sortOrder: Number(row.sortOrder ?? index),
        renderMode: (row.renderMode as RenderMode) ?? inferRenderMode(kind),
        parseStatus: (row.parseStatus as ParseStatus) ?? 'ready',
        parseError: row.parseError ? String(row.parseError) : null,
        metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {},
      } satisfies StoredMaterialItem;
    })
    .filter((item): item is StoredMaterialItem => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function reorderMaterials(materials: StoredMaterialItem[], ids: string[]) {
  const byId = new Map(materials.map((item) => [item.id, item]));
  return ids
    .map((id, index) => {
      const item = byId.get(id);
      if (!item) return null;
      return { ...item, sortOrder: index };
    })
    .filter((item): item is StoredMaterialItem => Boolean(item));
}

export function parseResearchProfileFromText(rawText: string): ResearchProfile {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n').map((line) => line.trim());
  const companyCode = matchField(lines, '公司编号') ?? '';
  const companyName = matchField(lines, '公司名称') ?? '';
  const industry = matchField(lines, '行业') ?? matchField(lines, '所属行业') ?? '';
  const alias = companyCode || companyName;
  const businessSummary = extractBusinessSummary(lines);
  const aFacts = extractAFacts(lines);

  return {
    companyCode,
    companyName,
    industry,
    alias,
    businessSummary,
    aFacts,
    rawText,
  };
}

function matchField(lines: string[], label: string) {
  const line = lines.find((entry) => entry.startsWith(`${label}：`) || entry.startsWith(`${label}:`));
  if (!line) return null;
  return line.split(/[：:]/).slice(1).join(':').trim();
}

function extractBusinessSummary(lines: string[]) {
  const index = lines.findIndex((entry) => entry.startsWith('业务简介'));
  if (index === -1) return '';
  const direct = lines[index].split(/[：:]/).slice(1).join(':').trim();
  if (direct) return direct;
  for (let i = index + 1; i < lines.length; i += 1) {
    if (lines[i]) return lines[i];
  }
  return '';
}

function extractAFacts(lines: string[]) {
  const results: { index: number; label: string; value: string }[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.includes('A.1') && line.includes('标准答案')) {
      inSection = true;
      continue;
    }
    if (inSection && /^四[、.]/.test(line)) break;
    if (!inSection) continue;
    const match = line.match(/^(\d+)\.\s*([^：:]+)[：:]\s*(.+)$/);
    if (!match) continue;
    results.push({
      index: Number(match[1]),
      label: match[2].trim(),
      value: match[3].trim(),
    });
  }
  return results;
}

export function readUtf8File(filePath: string) {
  return readFileSync(filePath, 'utf-8');
}

export function ensureBaselineP01Files() {
  if (!existsSync(BASELINE_P01_DIR)) return [];
  return readdirSorted(BASELINE_P01_DIR)
    .filter((filename) => inferMaterialKind(filename) !== null)
    .map((filename) => ({
      filename,
      fullPath: join(BASELINE_P01_DIR, filename),
    }));
}

export function scanCaseLibrary(rootDir = CASE_LIBRARY_ROOT): LibraryCaseDefinition[] {
  if (!existsSync(rootDir)) return [];

  const formalCases = existsSync(FORMAL_CASE_LIBRARY_ROOT)
    ? scanCaseRoot(FORMAL_CASE_LIBRARY_ROOT, 'formal')
    : scanCaseRoot(rootDir, 'formal', new Set(['正式', '测试轮']));

  const practiceCases = existsSync(PRACTICE_CASE_LIBRARY_ROOT)
    ? scanCaseRoot(PRACTICE_CASE_LIBRARY_ROOT, 'practice')
    : [];

  if (practiceCases.length === 0) {
    const fallbackPractice = parseCaseFolder(BASELINE_P01_DIR, 'P01', 0, 'practice');
    if (fallbackPractice) {
      practiceCases.push(fallbackPractice);
    }
  }

  return [...formalCases, ...practiceCases];
}

function scanCaseRoot(
  rootDir: string,
  usage: 'formal' | 'practice',
  excludeFolderNames: Set<string> = new Set(),
) {
  if (!existsSync(rootDir)) return [];

  const folderNames = readdirSorted(rootDir).filter((entry) => {
    if (excludeFolderNames.has(entry)) return false;
    const entryPath = join(rootDir, entry);
    return statSync(entryPath).isDirectory();
  });

  return folderNames
    .map((folderName, index) => parseCaseFolder(join(rootDir, folderName), folderName, index, usage))
    .filter((item): item is LibraryCaseDefinition => Boolean(item));
}

function parseCaseFolder(
  folderPath: string,
  folderName: string,
  index: number,
  usage: 'formal' | 'practice',
): LibraryCaseDefinition | null {
  if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) return null;
  const manifest = readCaseManifest(folderPath);
  const participantDir = resolveCaseSubdir(folderPath, manifest?.participantDir, 'participant');
  const researchDir = resolveCaseSubdir(folderPath, manifest?.researchDir, 'research');
  const directFiles = listMaterialFiles(folderPath, folderPath);
  const roleScopedParticipantMaterials = participantDir
    ? listParticipantMaterials(participantDir, folderPath, manifest)
    : directFiles
        .filter((entry) => classifyAudience(entry.displayName, entry.relativePath) === 'participant')
        .map((entry) => ({ ...entry, participantRole: 'shared' as const }));
  const participantMaterials = roleScopedParticipantMaterials.length
    ? roleScopedParticipantMaterials
    : directFiles
        .filter((entry) => classifyAudience(entry.displayName, entry.relativePath) === 'participant')
        .map((entry) => ({ ...entry, participantRole: 'shared' as const }));
  const researchMaterials = researchDir
    ? listMaterialFiles(researchDir, folderPath)
    : directFiles.filter((entry) => classifyAudience(entry.displayName, entry.relativePath) === 'research');

  if (participantMaterials.length === 0 && researchMaterials.length === 0) return null;

  return {
    folderName,
    folderPath,
    usage: manifest?.usage ?? usage,
    caseCode: manifest?.caseCode?.trim() || folderName,
    companyName: manifest?.companyName?.trim() || folderName,
    roundLabel: manifest?.roundLabel?.trim() || manifest?.caseCode?.trim() || folderName,
    sector: manifest?.sector?.trim() || '待补充',
    summary: manifest?.summary?.trim() || `${folderName} 题库材料`,
    tags: Array.isArray(manifest?.tags) && manifest.tags.length > 0 ? manifest.tags : [folderName, '题库案例'],
    sortOrder: typeof manifest?.sortOrder === 'number' ? manifest.sortOrder : index + 1,
    participantMaterials,
    researchMaterials,
    autoFillSourceRelativePath:
      manifest?.autoFillSource?.trim() ||
      researchMaterials.find((entry) => isResearchProfileFile(entry.displayName))?.relativePath ||
      null,
  };
}

function readCaseManifest(folderPath: string): CaseManifest | null {
  const manifestPath = join(folderPath, 'case.json');
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readUtf8File(manifestPath)) as CaseManifest;
  } catch {
    return null;
  }
}

function resolveCaseSubdir(folderPath: string, configuredDirName: string | undefined, fallbackDirName: string) {
  if (configuredDirName) {
    const configured = join(folderPath, configuredDirName);
    if (existsSync(configured) && statSync(configured).isDirectory()) return configured;
  }
  const fallback = join(folderPath, fallbackDirName);
  if (existsSync(fallback) && statSync(fallback).isDirectory()) return fallback;
  return null;
}

function listParticipantMaterials(folderPath: string, relativeBaseDir: string, manifest?: CaseManifest | null) {
  const sharedDir = resolveCaseSubdir(folderPath, manifest?.sharedDir, 'shared');
  const diligenceDir = resolveCaseSubdir(folderPath, manifest?.diligenceDir, 'diligence');
  const managerDir = resolveCaseSubdir(folderPath, manifest?.managerDir, 'manager');

  const scopedMaterials = [
    ...listRoleScopedMaterialFiles(sharedDir, relativeBaseDir, 'shared'),
    ...listRoleScopedMaterialFiles(diligenceDir, relativeBaseDir, 'A'),
    ...listRoleScopedMaterialFiles(managerDir, relativeBaseDir, 'B'),
  ];

  if (scopedMaterials.length > 0) return scopedMaterials;

  return listMaterialFiles(folderPath, relativeBaseDir).map((entry) => ({
    ...entry,
    participantRole: 'shared' as const,
  }));
}

function listRoleScopedMaterialFiles(
  dir: string | null,
  relativeBaseDir: string,
  participantRole: MaterialParticipantRole,
) {
  if (!dir) return [];
  return listMaterialFiles(dir, relativeBaseDir).map((entry) => ({
    ...entry,
    participantRole,
  }));
}

function listMaterialFiles(dir: string, relativeBaseDir: string) {
  return readdirSorted(dir)
    .filter((entry) => {
      const fullPath = join(dir, entry);
      return statSync(fullPath).isFile() && inferMaterialKind(entry) !== null;
    })
    .map((entry) => {
      const fullPath = join(dir, entry);
      return {
        fullPath,
        relativePath: relative(relativeBaseDir, fullPath).replace(/\\/g, '/'),
        displayName: entry,
      };
    });
}

function classifyAudience(displayName: string, relativePath: string): MaterialAudience {
  const normalized = `${displayName} ${relativePath}`.toLowerCase();
  if (
    normalized.includes('research') ||
    normalized.includes('研究者用') ||
    normalized.includes('信息点记录') ||
    normalized.includes('答案')
  ) {
    return 'research';
  }
  return 'participant';
}

function isResearchProfileFile(displayName: string) {
  return displayName.includes('信息点记录') || displayName.includes('研究者用');
}

function readdirSorted(dir: string) {
  const entries = readdirSync(dir) as string[];
  return [...entries].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function saveTempBufferAsFile(buffer: Buffer, targetPath: string) {
  const dir = resolve(targetPath, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(targetPath, buffer);
}
