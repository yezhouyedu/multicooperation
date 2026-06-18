'use client';

import type { QuestionnaireItem, QuestionnaireTemplate } from '@/lib/session-runtime';
import { useMemo, useState } from 'react';

type AnswerValue = string | number | string[];
export type QuestionnaireAnswers = Record<string, AnswerValue>;

type Props = {
  questionnaire: QuestionnaireTemplate;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (answers: QuestionnaireAnswers) => void | Promise<void>;
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function shouldShowFollowup(item: QuestionnaireItem, value: AnswerValue | undefined) {
  if (!item.followup || value === undefined) return false;
  const answer = Array.isArray(value) ? value.map(normalizeText).join(' / ') : normalizeText(value);
  const trigger = normalizeText(item.followup.triggerText);

  if (trigger.includes('mc1-01')) return false;
  if (trigger.includes('yes') || trigger.includes('是')) return answer === 'yes' || answer === '是';
  if (trigger.includes('serious') || trigger.includes('severe') || trigger.includes('严重') || trigger.includes('明显')) {
    return answer.includes('serious') || answer.includes('severe') || answer.includes('严重') || answer.includes('明显');
  }
  return false;
}

function isAnswered(item: QuestionnaireItem, value: AnswerValue | undefined) {
  if (!item.required) return true;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && String(value).trim() !== '';
}

export function QuestionnaireForm({ questionnaire, submitting = false, submitLabel = '提交问卷', onSubmit }: Props) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [followups, setFollowups] = useState<Record<string, string>>({});
  const sections = useMemo(
    () => (questionnaire.sections?.length ? questionnaire.sections : [{ title: questionnaire.title, items: questionnaire.items }]),
    [questionnaire.items, questionnaire.sections, questionnaire.title],
  );
  const allItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const canSubmit = useMemo(() => allItems.every((item) => isAnswered(item, answers[item.code])), [allItems, answers]);
  const answeredCount = useMemo(() => allItems.filter((item) => isAnswered(item, answers[item.code])).length, [allItems, answers]);

  function updateAnswer(code: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [code]: value }));
  }

  function toggleMulti(code: string, option: string) {
    const current = Array.isArray(answers[code]) ? (answers[code] as string[]) : [];
    updateAnswer(code, current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    const payload: QuestionnaireAnswers = { ...answers };
    for (const [code, value] of Object.entries(followups)) {
      if (value.trim()) payload[`${code}__followup`] = value.trim();
    }
    await onSubmit(payload);
  }

  return (
    <div className="space-y-6">
      {/* 进度指示器 */}
      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-[#1e80ff] transition-all duration-300"
            style={{ width: `${allItems.length > 0 ? (answeredCount / allItems.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[#1e80ff]">
          {answeredCount}/{allItems.length}
        </span>
      </div>

      {sections.map((section, sectionIndex) => (
        <section key={`${section.title}-${sectionIndex}`} className="space-y-4">
          {sections.length > 1 ? (
            <div className="border-b border-[#e5e6eb] pb-2 text-base font-semibold text-[#1d2129]">{section.title}</div>
          ) : null}
          {section.items.map((item, itemIndex) => {
            const value = answers[item.code];
            const isScaleType = item.type === 'scale';
            const scaleCount = isScaleType ? (item.max ?? 7) - (item.min ?? 1) + 1 : 0;
            const scaleMin = isScaleType ? (item.min ?? 1) : 1;

            return (
              <div key={item.code} className="rounded-xl border border-[#eaecf0] bg-white p-5">
                <div className="mb-3 text-sm font-semibold leading-6 text-[#1d2129]">
                  {itemIndex + 1}. {item.prompt}
                  {item.required ? <span className="ml-1 text-red-500">*</span> : null}
                </div>

                {/* 量表题：1-7 数字 + 两端标签 */}
                {isScaleType ? (
                  <div className="mt-4">
                    {/* 标签行：左端点 / 右端点 */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-[#86909c]">{item.minLabel}</span>
                      <span className="text-xs font-medium text-[#86909c]">{item.maxLabel}</span>
                    </div>
                    {/* 数字按钮行 */}
                    <div className="flex items-center gap-0">
                      {Array.from({ length: scaleCount }, (_, index) => scaleMin + index).map((score, idx) => {
                        const isSelected = value === score;
                        const isFirst = idx === 0;
                        const isLast = idx === scaleCount - 1;
                        return (
                          <button
                            key={score}
                            type="button"
                            onClick={() => updateAnswer(item.code, score)}
                            className={`relative flex h-11 flex-1 items-center justify-center border text-sm font-semibold transition-all duration-150
                              ${isFirst ? 'rounded-l-lg' : ''}
                              ${isLast ? 'rounded-r-lg' : ''}
                              ${!isFirst ? '-ml-px' : ''}
                              ${isSelected
                                ? 'z-10 border-[#1e80ff] bg-[#1e80ff] text-white shadow-[0_0_0_2px_rgba(30,128,255,0.2)]'
                                : 'border-[#e2e5ea] bg-white text-[#4e5969] hover:border-[#93c5fd] hover:bg-blue-50/50'
                              }`}
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                    {/* 刻度标记行 */}
                    <div className="mt-2 flex items-center justify-between px-1">
                      {Array.from({ length: scaleCount }, (_, index) => scaleMin + index).map((score) => (
                        <span
                          key={score}
                          className={`w-0 flex-1 text-center text-[10px] ${
                            value === score ? 'font-semibold text-[#1e80ff]' : 'text-[#c9cdd4]'
                          }`}
                        >
                          {score}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 单选题 */}
                {item.type === 'single' ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {(item.options ?? []).map((option) => {
                      const isSelected = value === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => updateAnswer(item.code, option)}
                          className={`group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-150
                            ${isSelected
                              ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff] shadow-[0_0_0_1px_rgba(30,128,255,0.1)]'
                              : 'border-[#eaecf0] bg-white text-[#4e5969] hover:border-[#93c5fd] hover:bg-blue-50/30'
                            }`}
                        >
                          {/* 选中指示器 */}
                          <span
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150
                              ${isSelected
                                ? 'border-[#1e80ff] bg-[#1e80ff]'
                                : 'border-[#d9dce2] bg-white group-hover:border-[#93c5fd]'
                              }`}
                          >
                            {isSelected && (
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="leading-relaxed">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* 多选题 */}
                {item.type === 'multi' ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {(item.options ?? []).map((option) => {
                      const selected = Array.isArray(value) && value.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleMulti(item.code, option)}
                          className={`group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-150
                            ${selected
                              ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff] shadow-[0_0_0_1px_rgba(30,128,255,0.1)]'
                              : 'border-[#eaecf0] bg-white text-[#4e5969] hover:border-[#93c5fd] hover:bg-blue-50/30'
                            }`}
                        >
                          {/* 选中指示器：复选框 */}
                          <span
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all duration-150
                              ${selected
                                ? 'border-[#1e80ff] bg-[#1e80ff]'
                                : 'border-[#d9dce2] bg-white group-hover:border-[#93c5fd]'
                              }`}
                          >
                            {selected && (
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="leading-relaxed">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* 数字输入 */}
                {item.type === 'number' ? (
                  <input
                    type="number"
                    value={typeof value === 'number' || typeof value === 'string' ? value : ''}
                    onChange={(event) => updateAnswer(item.code, event.target.value)}
                    className="w-full max-w-sm rounded-lg border border-[#e2e5ea] bg-[#fafbfc] px-4 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-[#1e80ff] focus:bg-white focus:shadow-[0_0_0_3px_rgba(30,128,255,0.08)]"
                  />
                ) : null}

                {/* 文本输入 */}
                {item.type === 'text' ? (
                  <textarea
                    maxLength={item.maxLength}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => updateAnswer(item.code, event.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-lg border border-[#e2e5ea] bg-[#fafbfc] px-4 py-3 text-sm leading-relaxed outline-none transition-colors duration-150 focus:border-[#1e80ff] focus:bg-white focus:shadow-[0_0_0_3px_rgba(30,128,255,0.08)]"
                  />
                ) : null}

                {/* 条件追问 */}
                {shouldShowFollowup(item, value) ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <div className="mb-2 text-xs font-medium text-amber-600">追问</div>
                    <textarea
                      placeholder={item.followup?.prompt ?? '请补充说明'}
                      value={followups[item.code] ?? ''}
                      onChange={(event) => setFollowups((prev) => ({ ...prev, [item.code]: event.target.value }))}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm leading-relaxed outline-none transition-colors duration-150 focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.08)]"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}

      {/* 提交按钮 */}
      <div className="flex items-center justify-between rounded-xl border border-[#eaecf0] bg-white px-5 py-4">
        <span className="text-sm text-[#86909c]">
          {canSubmit ? '所有必填项已完成' : `还有 ${allItems.length - answeredCount} 项必填`}
        </span>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || submitting}
          className="rounded-lg bg-[#1e80ff] px-8 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-150 hover:bg-[#1168e3] hover:shadow-[0_2px_8px_rgba(30,128,255,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              提交中...
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </div>
  );
}
