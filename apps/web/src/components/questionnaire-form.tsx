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
      {sections.map((section, sectionIndex) => (
        <section key={`${section.title}-${sectionIndex}`} className="space-y-4">
          {sections.length > 1 ? (
            <div className="border-b border-[#e5e6eb] pb-2 text-base font-semibold text-[#1d2129]">{section.title}</div>
          ) : null}
          {section.items.map((item, itemIndex) => {
            const value = answers[item.code];
            return (
              <div key={item.code} className="rounded-xl border border-[#eaecf0] bg-white p-5">
                <div className="mb-3 text-sm font-semibold leading-6 text-[#1d2129]">
                  {itemIndex + 1}. {item.prompt}
                  {item.required ? <span className="ml-1 text-red-500">*</span> : null}
                </div>

                {item.type === 'scale' ? (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: (item.max ?? 7) - (item.min ?? 1) + 1 }, (_, index) => (item.min ?? 1) + index).map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => updateAnswer(item.code, score)}
                          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                            value === score
                              ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff]'
                              : 'border-[#e5e6eb] bg-white text-[#4e5969] hover:border-blue-200'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex max-w-xl justify-between text-xs text-[#86909c]">
                      <span>{item.minLabel}</span>
                      <span>{item.maxLabel}</span>
                    </div>
                  </div>
                ) : null}

                {item.type === 'single' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(item.options ?? []).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateAnswer(item.code, option)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                          value === option
                            ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff]'
                            : 'border-[#eaecf0] bg-white hover:border-blue-200 hover:bg-blue-50/50'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}

                {item.type === 'multi' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(item.options ?? []).map((option) => {
                      const selected = Array.isArray(value) && value.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleMulti(item.code, option)}
                          className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                            selected
                              ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff]'
                              : 'border-[#eaecf0] bg-white hover:border-blue-200 hover:bg-blue-50/50'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {item.type === 'number' ? (
                  <input
                    type="number"
                    value={typeof value === 'number' || typeof value === 'string' ? value : ''}
                    onChange={(event) => updateAnswer(item.code, event.target.value)}
                    className="w-full max-w-sm rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]"
                  />
                ) : null}

                {item.type === 'text' ? (
                  <textarea
                    maxLength={item.maxLength}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => updateAnswer(item.code, event.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]"
                  />
                ) : null}

                {shouldShowFollowup(item, value) ? (
                  <textarea
                    placeholder={item.followup?.prompt ?? '请补充说明'}
                    value={followups[item.code] ?? ''}
                    onChange={(event) => setFollowups((prev) => ({ ...prev, [item.code]: event.target.value }))}
                    rows={3}
                    className="mt-3 w-full resize-y rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                ) : null}
              </div>
            );
          })}
        </section>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || submitting}
          className="rounded-lg bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1168e3] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? '提交中...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
