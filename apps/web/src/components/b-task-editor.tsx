'use client';

import { enqueueDraftSave, removeQueuedDraft, saveLocalDraft } from '@/lib/draft-sync';
import { idempotencyHeaders } from '@/lib/idempotency';
import type { CompanyData } from '@/lib/session-runtime';
import { recordTimestampEvent } from '@/lib/timestamp-events';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type SourceOption = '自有材料' | '上游尽调信息' | '上游备注' | '上游材料' | '';

type InfoPoint = {
  text: string;
  source: SourceOption;
};

type BEditorData = {
  opportunities?: InfoPoint[];
  risks?: InfoPoint[];
  overallAssessment?: string;
  finalDecision?: '投资' | '不投资' | '';
  confidence?: 1 | 2 | 3 | 4 | 5 | null;
  noObviousOpportunity?: boolean;
  noObviousRisk?: boolean;
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
const sourceOptions: Exclude<SourceOption, ''>[] = ['自有材料', '上游尽调信息', '上游备注', '上游材料'];
const minInfoRows = 2;
const maxInfoLength = 50;
const maxAssessmentLength = 120;

function createEmptyInfoPoint(): InfoPoint {
  return { text: '', source: '' };
}

function padInfoPoints(points?: InfoPoint[]) {
  const normalized = Array.isArray(points)
    ? points.map((item) => ({ text: item.text ?? '', source: item.source ?? '' }))
    : [];
  while (normalized.length < minInfoRows) normalized.push(createEmptyInfoPoint());
  return normalized;
}

function normalizeData(value: unknown) {
  const data = (value && typeof value === 'object' ? value : {}) as BEditorData;
  return {
    opportunities: padInfoPoints(data.opportunities),
    risks: padInfoPoints(data.risks),
    overallAssessment: typeof data.overallAssessment === 'string' ? data.overallAssessment : '',
    finalDecision: data.finalDecision === '投资' || data.finalDecision === '不投资' ? data.finalDecision : '',
    confidence: typeof data.confidence === 'number' ? data.confidence : null,
    noObviousOpportunity: Boolean(data.noObviousOpportunity),
    noObviousRisk: Boolean(data.noObviousRisk),
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

function InfoPointSection({
  title,
  hint,
  checked,
  checkedLabel,
  rows,
  disabled,
  onToggle,
  onTextChange,
  onSourceChange,
  onAddRow,
  onRemoveRow,
}: {
  title: string;
  hint: string;
  checked: boolean;
  checkedLabel: string;
  rows: InfoPoint[];
  disabled: boolean;
  onToggle: (value: boolean) => void;
  onTextChange: (index: number, value: string) => void;
  onSourceChange: (index: number, value: SourceOption) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[16px] font-bold">{title}</h3>
        <p className="mt-1 text-[13px] leading-6 text-[#4e5969]">{hint}</p>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-[#1d2129]">
        <input type="checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} disabled={disabled} />
        <span>{checkedLabel}</span>
      </label>
      <DocTable minWidth="min-w-[920px]">
        <tbody>
          <tr>
            <Th className="w-[90px]">序号</Th>
            <Th>信息简述（≤50字）</Th>
            <Th className="w-[280px]">主要来源（四选一）</Th>
            <Th className="w-[90px]">操作</Th>
          </tr>
          {rows.map((row, index) => (
            <tr key={`${title}-${index}`}>
              <Td>{index + 1}</Td>
              <Td>
                <textarea
                  value={row.text}
                  onChange={(event) => onTextChange(index, event.target.value.slice(0, maxInfoLength))}
                  disabled={disabled || checked}
                  rows={2}
                  className="w-full resize-none border-none bg-transparent px-0 py-0 text-[13px] leading-6 outline-none focus:bg-[#fafbff] placeholder:text-[#b0b7c3] disabled:opacity-60"
                  placeholder="尽量写成会影响投资判断的事实或线索"
                />
              </Td>
              <Td>
                <div className="grid gap-1">
                  {sourceOptions.map((option) => (
                    <label key={`${title}-${index}-${option}`} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`${title}-${index}`}
                        checked={row.source === option}
                        onChange={() => onSourceChange(index, option)}
                        disabled={disabled || checked}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => onRemoveRow(index)}
                  disabled={disabled || checked || rows.length <= minInfoRows}
                  className="rounded border border-[#d0d7e2] px-2 py-1 text-xs text-[#4e5969] transition-colors duration-150 hover:bg-[#f5f7fa] disabled:opacity-50"
                >
                  删除
                </button>
              </Td>
            </tr>
          ))}
          <tr>
            <Td>+</Td>
            <Td className="text-[#86909c]">添加一条信息点</Td>
            <Td />
            <Td>
              <button
                type="button"
                onClick={onAddRow}
                disabled={disabled || checked}
                className="rounded border border-[#1e80ff] px-2 py-1 text-xs text-[#1e80ff] transition-colors duration-150 hover:bg-blue-50 disabled:opacity-50"
              >
                新增
              </button>
            </Td>
          </tr>
        </tbody>
      </DocTable>
    </section>
  );
}

export function BTaskEditor({
  sessionCode,
  participantId,
  taskId,
  initialData,
  company,
  disabled = false,
  phase = 'formal',
  segmentIndex = 0,
}: Props) {
  const normalized = useMemo(() => normalizeData(initialData), [initialData]);
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
        role: 'B',
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
        role: 'B',
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
      opportunities: form.opportunities,
      risks: form.risks,
      overallAssessment: form.overallAssessment,
      finalDecision: form.finalDecision,
      confidence: form.confidence,
      noObviousOpportunity: form.noObviousOpportunity,
      noObviousRisk: form.noObviousRisk,
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
      await saveLocalDraft({ sessionCode, taskId, role: 'B', section: 'main', payload });
      const response = await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/tasks/${taskId}/draft`, {
        method: 'POST',
        headers: idempotencyHeaders(`draft:${sessionCode}:${taskId}:B:main`, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          role: 'B',
          section: 'main',
          payload,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      await removeQueuedDraft(sessionCode, taskId, 'B', 'main');
      setIsDirty(false);
      setStatus(silent ? 'autosaved' : 'saved');
      window.dispatchEvent(new CustomEvent('task-draft-saved', { detail: { taskId, role: 'B', section: 'main', payload } }));
      window.dispatchEvent(new CustomEvent('workbench-draft-saved'));
    } catch (error) {
      await enqueueDraftSave({ sessionCode, taskId, role: 'B', section: 'main', payload }, error);
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

  function updateList(key: 'opportunities' | 'risks', updater: (rows: InfoPoint[]) => InfoPoint[]) {
    setForm((prev) => ({ ...prev, [key]: updater(prev[key]) }));
    touch();
  }

  const profile = company?.researchProfile;
  const companyCode = profile?.companyCode || company?.roundLabel || company?.name || '';
  const industry = profile?.industry || company?.sector || '';
  const alias = profile?.alias || company?.name || '';
  const summary = profile?.businessSummary || company?.summary || '';
  const opportunityCount = form.noObviousOpportunity ? 0 : form.opportunities.filter((item) => item.text.trim()).length;
  const riskCount = form.noObviousRisk ? 0 : form.risks.filter((item) => item.text.trim()).length;

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-6 text-[#1d2129]">
      <div className="rounded-lg border border-[#e2e5ea] bg-white px-8 py-7 shadow-sm">
        <div className="space-y-6">
          <div>
            <h2 className="text-center text-[22px] font-bold tracking-[0.02em]">B端投资判断表</h2>
            <div className="mt-6 space-y-1 text-[13px] leading-7 text-[#4e5969]">
              <div className="font-semibold text-[#1d2129]">填写说明</div>
              <div>1. 仅依据当前可见的材料、AI 辅助结果和已解锁的信息填写；不要使用材料之外的知识进行推测。</div>
              <div>2. 重要信息点可自由增加行。信息简述应简短、具体，尽量写成会影响投资判断的事实或判断。</div>
              <div>3. 每条机会或风险信息都必须选择一个“权重最大”的主要来源。</div>
              <div>4. 主要来源选项固定为：自有材料、上游尽调信息、上游备注、上游材料。AI 仅作为辅助工具，不作为来源选项。</div>
              <div>5. 综合判断用于说明你如何权衡机会与风险，不需要重复逐条罗列前面的信息点。</div>
              <div>6. 最终投资建议必须选择；判断信心用于表示你对最终建议的确定程度。</div>
            </div>
          </div>

          {(status || isAutosaving) && (
            <div className="text-xs text-[#86909c]">{isAutosaving ? '自动保存中...' : status}</div>
          )}

          <section className="space-y-3">
            <h3 className="text-[16px] font-bold">来源选项说明</h3>
            <DocTable>
              <tbody>
                <tr>
                  <Th className="w-[220px]">来源选项</Th>
                  <Th>含义</Th>
                </tr>
                <tr>
                  <Td>自有材料</Td>
                  <Td>投资经理当前公司材料。</Td>
                </tr>
                <tr>
                  <Td>上游尽调信息</Td>
                  <Td>尽调员主表中的基础数值摘录和材料线索记录。</Td>
                </tr>
                <tr>
                  <Td>上游备注</Td>
                  <Td>尽调员“给投资经理的总体交接备注”。</Td>
                </tr>
                <tr>
                  <Td>上游材料</Td>
                  <Td>投资经理主动查看并复核的尽调员原始材料。</Td>
                </tr>
              </tbody>
            </DocTable>
          </section>

          <section className="space-y-3">
            <h3 className="text-[16px] font-bold">一、公司信息</h3>
            <DocTable>
              <tbody>
                <tr>
                  <Td className="w-[220px]">公司编号</Td>
                  <Td>{companyCode}</Td>
                </tr>
                <tr>
                  <Td>行业</Td>
                  <Td>{industry || '待补充'}</Td>
                </tr>
                <tr>
                  <Td>公司简称/匿名代号</Td>
                  <Td>{alias}</Td>
                </tr>
                <tr>
                  <Td>业务简介</Td>
                  <Td>{summary || '待补充'}</Td>
                </tr>
              </tbody>
            </DocTable>
          </section>

          <InfoPointSection
            title="二、重要机会信息点枚举区（不用填写普通机会）"
            hint="若未发现重要机会，可勾选对应选项；否则请至少填写一条。"
            checked={form.noObviousOpportunity}
            checkedLabel="若未发现重要机会，可勾选此处：未发现重要机会。否则请至少填写一条。"
            rows={form.opportunities}
            disabled={disabled}
            onToggle={(value) => {
              setForm((prev) => ({ ...prev, noObviousOpportunity: value }));
              touch();
            }}
            onTextChange={(index, value) =>
              updateList('opportunities', (rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, text: value } : row)))
            }
            onSourceChange={(index, value) =>
              updateList('opportunities', (rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, source: value } : row)))
            }
            onAddRow={() => updateList('opportunities', (rows) => [...rows, createEmptyInfoPoint()])}
            onRemoveRow={(index) => updateList('opportunities', (rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
          />

          <InfoPointSection
            title="三、重要风险信息点枚举区（不用填写普通风险）"
            hint="若未发现重要风险，可勾选对应选项；否则请至少填写一条。"
            checked={form.noObviousRisk}
            checkedLabel="若未发现重要风险，可勾选此处：未发现重要风险。否则请至少填写一条。"
            rows={form.risks}
            disabled={disabled}
            onToggle={(value) => {
              setForm((prev) => ({ ...prev, noObviousRisk: value }));
              touch();
            }}
            onTextChange={(index, value) =>
              updateList('risks', (rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, text: value } : row)))
            }
            onSourceChange={(index, value) =>
              updateList('risks', (rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, source: value } : row)))
            }
            onAddRow={() => updateList('risks', (rows) => [...rows, createEmptyInfoPoint()])}
            onRemoveRow={(index) => updateList('risks', (rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
          />

          <section className="space-y-3">
            <div>
              <h3 className="text-[16px] font-bold">四、综合判断</h3>
              <p className="mt-1 text-[13px] leading-6 text-[#4e5969]">请简要说明你如何权衡上述机会和风险，并说明形成当前投资判断的主要理由。</p>
            </div>
            <DocTable>
              <tbody>
                <tr>
                  <Th className="w-[280px]">综合判断（建议≤120字）</Th>
                  <Td>
                    <textarea
                      value={form.overallAssessment}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, overallAssessment: event.target.value.slice(0, maxAssessmentLength) }));
                        touch();
                      }}
                      disabled={disabled}
                      rows={5}
                      className="w-full resize-none border-none bg-transparent px-0 py-0 text-[13px] leading-7 outline-none focus:bg-[#fafbff] placeholder:text-[#b0b7c3] disabled:opacity-60"
                    />
                  </Td>
                </tr>
              </tbody>
            </DocTable>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-[16px] font-bold">五、最终投资建议</h3>
              <p className="mt-1 text-[12px] leading-6 text-[#86909c]">提示：请在最终提交前检查机会/风险信息点、来源、综合判断和最终投资建议是否完整。</p>
            </div>
            <DocTable>
              <tbody>
                <tr>
                  <Td className="w-[280px]">识别到重要风险数量</Td>
                  <Td>{riskCount}</Td>
                </tr>
                <tr>
                  <Td>识别到重要机会数量</Td>
                  <Td>{opportunityCount}</Td>
                </tr>
                <tr>
                  <Td>识别到普通风险数量</Td>
                  <Td />
                </tr>
                <tr>
                  <Td>识别到普通机会数量</Td>
                  <Td />
                </tr>
                <tr>
                  <Td>最终投资建议</Td>
                  <Td>
                    <div className="flex flex-wrap gap-6">
                      {(['投资', '不投资'] as const).map((option) => (
                        <label key={option} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="final-decision"
                            checked={form.finalDecision === option}
                            onChange={() => {
                              setForm((prev) => ({ ...prev, finalDecision: option }));
                              touch();
                            }}
                            disabled={disabled}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </Td>
                </tr>
                <tr>
                  <Td>最终判断信心</Td>
                  <Td>
                    <div className="flex flex-wrap gap-5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label key={value} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="confidence"
                            checked={form.confidence === value}
                            onChange={() => {
                              setForm((prev) => ({ ...prev, confidence: value as 1 | 2 | 3 | 4 | 5 }));
                              touch();
                            }}
                            disabled={disabled}
                          />
                          <span>
                            {value}
                            {value === 1 ? ' 很不确定' : value === 5 ? ' 很确定' : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  </Td>
                </tr>
              </tbody>
            </DocTable>
          </section>
        </div>
      </div>
    </div>
  );
}
