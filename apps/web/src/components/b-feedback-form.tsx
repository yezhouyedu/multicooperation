'use client';

import { enqueueDraftSave, removeQueuedDraft, saveLocalDraft } from '@/lib/draft-sync';
import { idempotencyHeaders } from '@/lib/idempotency';
import { recordTimestampEvent } from '@/lib/timestamp-events';
import { useEffect, useMemo, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type FeedbackDraft = {
  q1?: '是' | '否' | '';
  q2?: '是' | '否' | '';
  q3?: string;
  q4?: string;
  q5?: string;
};

type Props = {
  sessionCode: string;
  participantId?: string;
  taskId: string;
  companyId?: string;
  companyName: string;
  companyNo: number;
  initialData?: unknown;
  phase?: 'practice' | 'formal';
  segmentIndex?: number;
  onSubmitted: () => void;
};

const Q3_OPTIONS = ['非常有帮助', '比较有帮助', '帮助有限', '几乎没有帮助'];
const Q4_OPTIONS = ['无明显缺失', '机会信息不足', '风险信息不足', '机会和风险信息都不足', '不确定'];
const Q5_OPTIONS = ['信息更完整', '重点更突出', '备注更明确', '证据来源更清楚', '暂无明显改进建议'];

function normalizeInitialData(value: unknown) {
  const data = value && typeof value === 'object' ? (value as FeedbackDraft) : {};
  return {
    q1: (data.q1 === '是' || data.q1 === '否' ? data.q1 : '') as '是' | '否' | '',
    q2: (data.q2 === '是' || data.q2 === '否' ? data.q2 : '') as '是' | '否' | '',
    q3: typeof data.q3 === 'string' ? data.q3 : '',
    q4: typeof data.q4 === 'string' ? data.q4 : '',
    q5: typeof data.q5 === 'string' ? data.q5 : '',
  };
}

export function BFeedbackForm({
  sessionCode,
  participantId,
  taskId,
  companyId,
  companyName,
  companyNo,
  initialData,
  phase = 'formal',
  segmentIndex = 0,
  onSubmitted,
}: Props) {
  const normalized = useMemo(() => normalizeInitialData(initialData), [initialData]);
  const [q1, setQ1] = useState<'是' | '否' | ''>(normalized.q1);
  const [q2, setQ2] = useState<'是' | '否' | ''>(normalized.q2);
  const [q3, setQ3] = useState(normalized.q3);
  const [q4, setQ4] = useState(normalized.q4);
  const [q5, setQ5] = useState(normalized.q5);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const pendingAnchorRef = useRef<string | null>(null);
  const lastMainContextEventAtRef = useRef(0);

  useEffect(() => {
    if (!dirty) {
      setQ1(normalized.q1);
      setQ2(normalized.q2);
      setQ3(normalized.q3);
      setQ4(normalized.q4);
      setQ5(normalized.q5);
    }
  }, [dirty, normalized]);

  const canSubmit = q1 !== '' && q2 !== '' && q3 !== '' && q4 !== '' && q5 !== '';

  function payload() {
    return { q1, q2, q3, q4, q5 };
  }

  function touch() {
    setDirty(true);
    window.dispatchEvent(new CustomEvent('workbench-draft-dirty'));
    const now = Date.now();
    if (now - lastMainContextEventAtRef.current > 2000) {
      lastMainContextEventAtRef.current = now;
      void recordTimestampEvent({
        sessionCode,
        participantId,
        role: 'B',
        eventType: 'main_context_activity',
        taskAssignmentId: taskId,
        companyId,
        phase,
        segmentIndex,
        payload: { activityKind: 'feedback_edit' },
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
        companyId,
        phase,
        segmentIndex,
        payload: { activityKind: 'feedback_edit', anchorType },
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

  async function saveDraft(silent = false) {
    if (!sessionCode || !taskId) return;
    if (silent) {
      setSaving(true);
    } else {
      setStatus('saving...');
    }

    const draftPayload = payload();
    try {
      await saveLocalDraft({ sessionCode, taskId, role: 'B', section: 'feedback', payload: draftPayload });
      const response = await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/tasks/${taskId}/draft`, {
        method: 'POST',
        headers: idempotencyHeaders(`draft:${sessionCode}:${taskId}:B:feedback`, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          role: 'B',
          section: 'feedback',
          payload: draftPayload,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      await removeQueuedDraft(sessionCode, taskId, 'B', 'feedback');
      setDirty(false);
      setStatus(silent ? 'autosaved' : 'saved');
      window.dispatchEvent(new CustomEvent('task-draft-saved', { detail: { taskId, role: 'B', section: 'feedback', payload: draftPayload } }));
      window.dispatchEvent(new CustomEvent('workbench-draft-saved'));
    } catch (error) {
      await enqueueDraftSave({ sessionCode, taskId, role: 'B', section: 'feedback', payload: draftPayload }, error);
      setStatus(silent ? 'local saved, waiting to sync' : 'local saved, will sync when online');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void saveDraft(true), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, q1, q2, q3, q4, q5]);

  useEffect(() => {
    const handler = () => void saveDraft();
    window.addEventListener('workbench-save-draft', handler);
    return () => window.removeEventListener('workbench-save-draft', handler);
  });

  async function handleSubmit() {
    if (!canSubmit) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('network unavailable, please submit after reconnecting');
      return;
    }
    setSubmitting(true);
    setError('');
    const submitPayload = {
      companyName,
      companyNo,
      sendFeedback: q1 === '是',
      q1,
      q2,
      q3,
      q4,
      q5,
    };
    try {
      await saveDraft(true);
      const res = await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
        method: 'POST',
        headers: idempotencyHeaders(`progress:${sessionCode}:${taskId}:b_feedback_submitted`, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ role: 'B', stage: 'b_feedback_submitted', payload: submitPayload }),
      });
      if (!res.ok) throw new Error('提交失败');

      if (q1 === '是') {
        await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
          method: 'POST',
          headers: idempotencyHeaders(`progress:${sessionCode}:${taskId}:b_feedback_to_a`, {
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            role: 'B',
            stage: 'b_feedback_to_a',
            payload: {
              companyName,
              companyNo,
              helpfulness: q3,
              missingContent: q4,
              improvement: q5,
              appreciative: q2 === '是',
            },
          }),
        });
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  function Radio({
    name,
    value,
    current,
    onChange,
  }: {
    name: string;
    value: string;
    current: string;
    onChange: (v: string) => void;
  }) {
    const checked = current === value;
    return (
      <label
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition ${
          checked
            ? 'border-[#1e80ff] bg-blue-50 font-semibold text-[#1e80ff]'
            : 'border-[#e5e6eb] bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/50'
        }`}
      >
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
        onChange={() => {
          onChange(value);
          touch();
        }}
          className="h-4 w-4 accent-[#1e80ff]"
        />
        {value}
      </label>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8 text-sm">
      <div>
        <div className="mb-1 text-xs font-black uppercase tracking-widest text-[#1e80ff]">本轮判断反馈</div>
        <div className="text-base font-bold text-gray-800">{companyName}</div>
        {status || saving ? <div className="mt-2 text-xs text-[#86909c]">{saving ? '自动保存中...' : status}</div> : null}
      </div>

      <section className="space-y-3">
        <div className="font-semibold text-gray-800">Q1. 是否希望将本次反馈发送给A？</div>
        <div className="flex gap-3">
          <Radio name="q1" value="是" current={q1} onChange={(v) => setQ1(v as '是' | '否')} />
          <Radio name="q1" value="否" current={q1} onChange={(v) => setQ1(v as '是' | '否')} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="font-semibold text-gray-800">Q2. 是否愿意向A表达感谢或认可？</div>
        <div className="flex gap-3">
          <Radio name="q2" value="是" current={q2} onChange={(v) => setQ2(v as '是' | '否')} />
          <Radio name="q2" value="否" current={q2} onChange={(v) => setQ2(v as '是' | '否')} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="font-semibold text-gray-800">Q3. A信息对你完成初步判断的帮助程度？</div>
        <div className="grid grid-cols-2 gap-2">
          {Q3_OPTIONS.map((opt) => (
            <Radio key={opt} name="q3" value={opt} current={q3} onChange={setQ3} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="font-semibold text-gray-800">Q4. A信息主要缺少哪类内容？</div>
        <div className="grid grid-cols-2 gap-2">
          {Q4_OPTIONS.map((opt) => (
            <Radio key={opt} name="q4" value={opt} current={q4} onChange={setQ4} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="font-semibold text-gray-800">Q5. 你最希望优先改进哪一点？</div>
        <div className="grid grid-cols-2 gap-2">
          {Q5_OPTIONS.map((opt) => (
            <Radio key={opt} name="q5" value={opt} current={q5} onChange={setQ5} />
          ))}
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-500">{error}</div> : null}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit || submitting}
        className="w-full rounded-lg bg-[#1e80ff] py-3.5 font-bold text-white shadow transition hover:bg-[#1168e3] disabled:opacity-40"
      >
        {submitting ? '提交中...' : '提交反馈并进入下一家公司'}
      </button>
    </div>
  );
}
