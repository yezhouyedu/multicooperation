'use client';

import { enqueueDraftSave, removeQueuedDraft, saveLocalDraft } from '@/lib/draft-sync';
import { idempotencyHeaders } from '@/lib/idempotency';
import type { CompanyData } from '@/lib/session-runtime';
import { recordTimestampEvent } from '@/lib/timestamp-events';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type MaterialClueRow = {
  materialName: string;
  opportunityStatus: '' | 'HAS' | 'NONE';
  opportunityEvidence: string;
  riskStatus: '' | 'HAS' | 'NONE';
  riskEvidence: string;
};

type AEditorData = {
  metrics?: Record<string, string | undefined>;
  materialClues?: MaterialClueRow[];
  noteTypes?: string[];
  handoffMemo?: string;
};

type Props = {
  sessionCode: string;
  participantId?: string;
  taskId?: string;
  initialData?: unknown;
  company?: CompanyData | null;
  disabled?: boolean;
  phase?: 'practice' | 'formal';
  segmentIndex?: number;
};

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
const MAX_EVIDENCE_LENGTH = 30;

const noteTypeOptions = ['跨材料关联提示', '可信度说明', '核验建议', '模糊线索/需谨慎判断', '留空'] as const;

function buildMaterialNames(company?: CompanyData | null) {
  const names = (company?.materials ?? []).map((item) => item.displayName).filter(Boolean);
  return names.map((name, index) => `${index + 1}`);
}

function buildDefaultRows(company?: CompanyData | null): MaterialClueRow[] {
  return buildMaterialNames(company).map((materialName) => ({
    materialName,
    opportunityStatus: '',
    opportunityEvidence: '',
    riskStatus: '',
    riskEvidence: '',
  }));
}

function normalizeData(value: unknown, company?: CompanyData | null) {
  const data = (value && typeof value === 'object' ? value : {}) as AEditorData;
  const metrics = data.metrics && typeof data.metrics === 'object' ? data.metrics : {};
  const defaultRows = buildDefaultRows(company);
  const sourceRows = Array.isArray(data.materialClues) ? data.materialClues : [];

  return {
    metrics: {
      indicator: metrics.indicator ?? metrics.starIndicator ?? '',
      content: metrics.content ?? metrics.starContent ?? '',
    },
    materialClues: defaultRows.map((row, index) => ({
      materialName: sourceRows[index]?.materialName || row.materialName,
      opportunityStatus: sourceRows[index]?.opportunityStatus ?? '',
      opportunityEvidence: sourceRows[index]?.opportunityEvidence ?? '',
      riskStatus: sourceRows[index]?.riskStatus ?? '',
      riskEvidence: sourceRows[index]?.riskEvidence ?? '',
    })),
    noteTypes: Array.isArray(data.noteTypes) ? data.noteTypes : [],
    handoffMemo: data.handoffMemo ?? '',
  };
}

function DocTable({ children, minWidth }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-[13px] leading-6 text-[#1d2129] ${minWidth ?? ''}`}>{children}</table>
    </div>
  );
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`border border-[#dde1e7] bg-[#f5f7fa] px-3 py-2 text-left font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`border border-[#dde1e7] px-3 py-2 align-top ${className}`}>{children}</td>;
}

function choiceLabel(value: '' | 'HAS' | 'NONE') {
  if (value === 'HAS') return '有';
  if (value === 'NONE') return '未发现';
  return '';
}

export function ATaskEditor({
  sessionCode,
  participantId,
  taskId,
  initialData,
  company,
  disabled = false,
  phase = 'formal',
  segmentIndex = 0,
}: Props) {
  const normalized = useMemo(() => normalizeData(initialData, company), [company, initialData]);
  const [form, setForm] = useState(normalized);
  const [status, setStatus] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const lastTaskIdRef = useRef(taskId);
  const pendingAnchorRef = useRef<string | null>(null);
  const lastMainContextEventAtRef = useRef(0);

  useEffect(() => {
    const taskChanged = taskId !== lastTaskIdRef.current;
    if (taskChanged || !isDirty) {
      setForm(normalized);
      if (taskChanged) {
        setStatus('');
        setIsDirty(false);
      }
    }
    lastTaskIdRef.current = taskId;
  }, [normalized, taskId, isDirty]);

  function touch() {
    setIsDirty(true);
    window.dispatchEvent(new CustomEvent('workbench-draft-dirty'));
    if (!taskId) return;
    const now = Date.now();
    if (now - lastMainContextEventAtRef.current > 2000) {
      lastMainContextEventAtRef.current = now;
      void recordTimestampEvent({
        sessionCode,
        participantId,
        role: 'A',
        eventType: 'main_context_activity',
        taskAssignmentId: taskId,
        companyId: company?.id,
        phase,
        segmentIndex,
        payload: { activityKind: 'edit' },
      });
    }
    if (pendingAnchorRef.current) {
      const anchorType = pendingAnchorRef.current;
      pendingAnchorRef.current = null;
      void recordTimestampEvent({
        sessionCode,
        participantId,
        role: 'A',
        eventType: 'mainline_activity',
        taskAssignmentId: taskId,
        companyId: company?.id,
        phase,
        segmentIndex,
        payload: { activityKind: 'edit', anchorType },
      });
    }
  }

  useEffect(() => {
    function handleAnchor(event: Event) {
      const detail = (event as CustomEvent<{ anchorType?: string }>).detail;
      pendingAnchorRef.current = detail?.anchorType ?? null;
    }
    window.addEventListener('timestamp-anchor', handleAnchor);
    return () => window.removeEventListener('timestamp-anchor', handleAnchor);
  }, []);

  function buildPayload() {
    return {
      metrics: form.metrics,
      materialClues: form.materialClues,
      noteTypes: form.noteTypes,
      handoffMemo: form.handoffMemo,
    };
  }

  async function saveDraft(silent = false) {
    if (!sessionCode || !taskId) {
      setStatus('preview mode, not saved');
      return;
    }
    if (silent) setIsAutosaving(true);
    else setStatus('saving...');

    const payload = buildPayload();
    try {
      await saveLocalDraft({ sessionCode, taskId, role: 'A', section: 'main', payload });
      const response = await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/tasks/${taskId}/draft`, {
        method: 'POST',
        headers: idempotencyHeaders(`draft:${sessionCode}:${taskId}:A:main`, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          role: 'A',
          section: 'main',
          payload,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      await removeQueuedDraft(sessionCode, taskId, 'A', 'main');
      setIsDirty(false);
      setStatus(silent ? 'autosaved' : 'saved');
      window.dispatchEvent(new CustomEvent('task-draft-saved', { detail: { taskId, role: 'A', section: 'main', payload } }));
      window.dispatchEvent(new CustomEvent('workbench-draft-saved'));
    } catch (error) {
      await enqueueDraftSave({ sessionCode, taskId, role: 'A', section: 'main', payload }, error);
      setStatus(silent ? 'local saved, waiting to sync' : 'local saved, will sync when online');
    } finally {
      setIsAutosaving(false);
    }
  }

  useEffect(() => {
    const handler = () => void saveDraft();
    window.addEventListener('workbench-save-draft', handler);
    return () => window.removeEventListener('workbench-save-draft', handler);
  });

  useEffect(() => {
    if (!isDirty || disabled || !sessionCode || !taskId) return;
    const timer = window.setTimeout(() => void saveDraft(true), 900);
    return () => window.clearTimeout(timer);
  }, [disabled, form, isDirty, sessionCode, taskId]);

  function updateMetric(key: 'indicator' | 'content', value: string) {
    setForm((prev) => ({ ...prev, metrics: { ...prev.metrics, [key]: value } }));
    touch();
  }

  function updateClueRow(index: number, patch: Partial<MaterialClueRow>) {
    setForm((prev) => ({
      ...prev,
      materialClues: prev.materialClues.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const nextRow = { ...row, ...patch };
        if (patch.opportunityStatus === 'NONE') nextRow.opportunityEvidence = '';
        if (patch.riskStatus === 'NONE') nextRow.riskEvidence = '';
        return nextRow;
      }),
    }));
    touch();
  }

  function toggleNoteType(type: string) {
    setForm((prev) => ({
      ...prev,
      noteTypes: prev.noteTypes.includes(type)
        ? prev.noteTypes.filter((item) => item !== type)
        : [...prev.noteTypes, type],
    }));
    touch();
  }

  const profile = company?.researchProfile;
  const alias = profile?.alias || company?.name || '';

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-6 text-[#1d2129]">
      <div className="rounded-lg border border-[#e2e5ea] bg-white px-8 py-7 shadow-sm">
        <div className="space-y-6">
          <div>
            <h2 className="text-center text-[22px] font-bold tracking-[0.02em]">A端任务表</h2>
            <div className="mt-6 space-y-1 text-[13px] leading-7 text-[#4e5969]">
              <div className="font-semibold text-[#1d2129]">填写说明</div>
              <div>1. 仅依据给定材料填写，不要使用材料之外的知识进行推测。</div>
              <div>2. A.1“基础数值摘录区”只填写材料中可直接提取的数值信息；如确实找不到，填写“材料未包含”。不允许重复用于 A.2。</div>
              <div>3. A.2“材料线索记录区”按材料顺序填写。每读完一份材料，判断是否发现与投资判断有关的机会线索或风险线索。</div>
              <div>4. A.3“给B的总体交接备注”为可选项，用于填写跨材料关联提示、可信度说明、建议B优先核验事项，或尚未坐实但值得注意的线索。</div>
            </div>
          </div>

          {(status || isAutosaving) && (
            <div className="text-xs text-[#86909c]">{isAutosaving ? '自动保存中...' : status}</div>
          )}

          <section className="space-y-3">
            <h3 className="text-[16px] font-bold">一、公司信息</h3>
            <DocTable>
              <tbody>
                <tr>
                  <Th className="w-[220px]">字段</Th>
                  <Th>填写内容</Th>
                </tr>
                <tr>
                  <Td>公司简称</Td>
                  <Td>{alias}</Td>
                </tr>
              </tbody>
            </DocTable>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-[16px] font-bold">二、A.1 基础数值摘录区</h3>
              <p className="mt-1 text-[13px] leading-6 text-[#4e5969]">
                材料2中有若干指标，请填写标记*号的指标及其内容，如【指标：人数|内容：5人】。无需自行计算复杂指标，不要做正常/异常判断。
              </p>
            </div>
            <DocTable>
              <tbody>
                <tr>
                  <Th className="w-[280px]">指标</Th>
                  <Th>内容</Th>
                </tr>
                <tr>
                  <Td>
                    <input
                      value={form.metrics.indicator}
                      onChange={(event) => updateMetric('indicator', event.target.value)}
                      disabled={disabled}
                      placeholder="例：总资产"
                      className="w-full border-none bg-transparent px-0 py-0 text-[13px] outline-none focus:bg-[#fafbff] placeholder:text-[#4e5969] disabled:opacity-60"
                    />
                  </Td>
                  <Td>
                    <input
                      value={form.metrics.content}
                      onChange={(event) => updateMetric('content', event.target.value)}
                      disabled={disabled}
                      placeholder="例：2亿元"
                      className="w-full border-none bg-transparent px-0 py-0 text-[13px] outline-none focus:bg-[#fafbff] placeholder:text-[#4e5969] disabled:opacity-60"
                    />
                  </Td>
                </tr>
              </tbody>
            </DocTable>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-[16px] font-bold">三、A.2 材料线索记录区</h3>
              <p className="mt-1 text-[13px] leading-6 text-[#4e5969]">
                每份材料的机会线索和风险线索都需选择“有”或“未发现”。选择“有”后必须填写30字以内证据片段；选择“未发现”后系统自动记为“无”。未选择任何选项的，记为“未作答”。证据片段请复制或概括最能支持判断的关键词、短语或短句，不需要写分析理由。
              </p>
            </div>
            <DocTable minWidth="min-w-[980px]">
              <tbody>
                <tr>
                  <Th className="w-[120px]">材料编号</Th>
                  <Th className="w-[180px]">是否发现机会线索</Th>
                  <Th>证据片段（≤30字）</Th>
                  <Th className="w-[180px]">是否发现风险线索</Th>
                  <Th>证据片段（≤30字）</Th>
                </tr>
                {form.materialClues.map((row, index) => (
                  <tr key={`${row.materialName}-${index}`}>
                    <Td>{row.materialName}</Td>
                    <Td>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={row.opportunityStatus === 'HAS'}
                            onChange={() => updateClueRow(index, { opportunityStatus: 'HAS' })}
                            disabled={disabled}
                          />
                          <span>有</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={row.opportunityStatus === 'NONE'}
                            onChange={() => updateClueRow(index, { opportunityStatus: 'NONE' })}
                            disabled={disabled}
                          />
                          <span>未发现</span>
                        </label>
                      </div>
                    </Td>
                    <Td>
                      <input
                        value={row.opportunityEvidence}
                        onChange={(event) =>
                          updateClueRow(index, { opportunityEvidence: event.target.value.slice(0, MAX_EVIDENCE_LENGTH) })
                        }
                        disabled={disabled || row.opportunityStatus !== 'HAS'}
                        placeholder={choiceLabel(row.opportunityStatus) === '有' ? '选择“有”后必填，≤30字' : ''}
                        className="w-full border-none bg-transparent px-0 py-0 text-[13px] outline-none focus:bg-[#fafbff] placeholder:text-[#b0b7c3] disabled:opacity-60"
                      />
                    </Td>
                    <Td>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={row.riskStatus === 'HAS'}
                            onChange={() => updateClueRow(index, { riskStatus: 'HAS' })}
                            disabled={disabled}
                          />
                          <span>有</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={row.riskStatus === 'NONE'}
                            onChange={() => updateClueRow(index, { riskStatus: 'NONE' })}
                            disabled={disabled}
                          />
                          <span>未发现</span>
                        </label>
                      </div>
                    </Td>
                    <Td>
                      <input
                        value={row.riskEvidence}
                        onChange={(event) =>
                          updateClueRow(index, { riskEvidence: event.target.value.slice(0, MAX_EVIDENCE_LENGTH) })
                        }
                        disabled={disabled || row.riskStatus !== 'HAS'}
                        placeholder={choiceLabel(row.riskStatus) === '有' ? '选择“有”后必填，≤30字' : ''}
                        className="w-full border-none bg-transparent px-0 py-0 text-[13px] outline-none focus:bg-[#fafbff] placeholder:text-[#b0b7c3] disabled:opacity-60"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DocTable>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-[16px] font-bold">四、A.3 给B的总体交接备注</h3>
              <p className="mt-1 text-[13px] leading-6 text-[#4e5969]">
                本栏为可选项。若你认为某些线索需要B特别核验、不同材料之间存在口径差异、某项风险或机会可能影响最终判断，可在此简要提醒B。没有特别需要提醒的内容选留空。
              </p>
            </div>
            <DocTable>
              <tbody>
                <tr>
                  <Th className="w-[220px]">字段</Th>
                  <Th>填写内容</Th>
                </tr>
                <tr>
                  <Td>备注类型（可多选）</Td>
                  <Td>
                    <div className="grid gap-2 md:grid-cols-2">
                      {noteTypeOptions.map((option) => (
                        <label key={option} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.noteTypes.includes(option)}
                            onChange={() => toggleNoteType(option)}
                            disabled={disabled}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </Td>
                </tr>
                <tr>
                  <Td>总体交接备注</Td>
                  <Td>
                    <textarea
                      value={form.handoffMemo}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, handoffMemo: event.target.value }));
                        touch();
                      }}
                      disabled={disabled}
                      rows={6}
                      placeholder="没有特别需要提醒的内容，可保持留空。"
                      className="w-full resize-none border-none bg-transparent px-0 py-0 text-[13px] leading-7 outline-none focus:bg-[#fafbff] placeholder:text-[#b0b7c3] disabled:opacity-60"
                    />
                  </Td>
                </tr>
              </tbody>
            </DocTable>
            <p className="text-[12px] leading-6 text-[#86909c]">
              提示：请优先完成 A.1 基础数值摘录区和 A.2 材料线索记录区；A.3 仅在你认为有必要提醒 B 时填写。
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-[16px] font-bold">五、绩效说明</h3>
            <div className="space-y-3 rounded-lg border border-[#dde1e7] bg-[#f8fafc] px-4 py-4 text-[13px] leading-7 text-[#4e5969]">
              <div>
                <div className="font-semibold text-[#1d2129]">你的个人绩效按你完成的公司累计，主要来自A.1和A.2。</div>
                <p>A.1基础数值摘录中，每填对一个基础数值可得分。</p>
                <p>A.2材料线索记录中，每正确判断一份材料是否存在机会线索或风险线索可得分。选择“有”时，证据片段与材料内容相关可加分。</p>
              </div>
              <div>
                <div className="font-semibold text-[#1d2129]">以下情形会扣除相应绩效分：</div>
                <p>把材料中不存在的机会或风险标为“有”；</p>
                <p>证据片段与所填机会或风险明显无关。</p>
              </div>
              <p>A.3总体交接备注不直接计入A个人绩效，但可能帮助B完成公司判断任务，从而提高团队绩效。</p>
              <div>
                <div className="font-semibold text-[#1d2129]">团队绩效提醒</div>
                <p>团队绩效只计算B完整提交的公司。B最终投资建议是否正确、重要机会和重要风险是否覆盖、普通机会和普通风险数量是否准确，会影响团队绩效。</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
