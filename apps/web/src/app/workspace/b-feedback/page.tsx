'use client';

import { BFeedbackForm } from '@/components/b-feedback-form';
import { SessionTopbar } from '@/components/session-topbar';
import { useSessionRuntime, useTaskDraft } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function WorkspaceBFeedbackPage() {
  const router = useRouter();
  const { bootstrap, runtime, loading } = useSessionRuntime();
  const currentTaskId = runtime?.currentTask?.id;
  const { draft } = useTaskDraft(bootstrap?.sessionCode, currentTaskId, 'B', 'feedback');

  useEffect(() => {
    if (!bootstrap || !currentTaskId || runtime?.currentTask?.bCompletedAt) return;
    sessionStorage.setItem(`b_feedback_resume:${bootstrap.sessionCode}`, currentTaskId);
  }, [bootstrap, currentTaskId, runtime?.currentTask?.bCompletedAt]);

  const redirectPath =
    !loading && !bootstrap
      ? '/login'
      : !loading && runtime?.assignedRole === 'A'
        ? '/workspace/a'
        : !loading && runtime?.phase === 'end'
          ? '/workspace/end'
          : !loading && runtime?.phase === 'pre_segment_instruction'
            ? '/pre-segment-instruction'
          : !loading && runtime?.phase === 'formal_break'
            ? '/break'
            : !loading && (!runtime?.currentTask || !runtime.bCanSubmit)
              ? '/workspace/b'
              : null;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  if (redirectPath) return null;

  async function handleSubmitted() {
    if (!bootstrap || !runtime?.currentTask) return;
    await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/tasks/${runtime.currentTask.id}/b-complete`, {
      method: 'POST',
    }).catch(() => {});
    sessionStorage.removeItem(`b_feedback_resume:${bootstrap.sessionCode}`);
    router.push('/workspace/b');
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#f0f2f5] text-sm text-[#1d2129]">
      <div className="flex h-full flex-col">
        <SessionTopbar
          roleLabel="投资经理"
          currentLabel={runtime?.currentTask?.company?.name ?? '当前项目'}
          stageLabel="当前阶段"
          countdownLabel="--:--"
        />
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {bootstrap && runtime?.currentTask?.company ? (
            <BFeedbackForm
              sessionCode={bootstrap.sessionCode}
              taskId={runtime.currentTask.id}
              companyName={runtime.currentTask.company.name}
              companyNo={runtime.currentTask.sortOrder}
              initialData={draft}
              onSubmitted={() => void handleSubmitted()}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
