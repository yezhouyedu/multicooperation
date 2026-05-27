'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export type MaterialItem = {
  id: string;
  displayName: string;
  sourceFilename: string;
  kind: 'txt' | 'docx' | 'pdf' | 'xlsx';
  storageKey: string;
  mimeType: string;
  sortOrder: number;
  renderMode: 'text' | 'docx-preview' | 'pdf' | 'spreadsheet';
  parseStatus: 'ready' | 'error';
  parseError: string | null;
  metadata: Record<string, unknown>;
  url: string;
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

export type CompanyData = {
  id: string;
  name: string;
  roundLabel: string;
  sector: string;
  tags: string[];
  summary: string;
  materials: MaterialItem[];
  researchProfile: ResearchProfile | null;
  autoFillSourceMaterialId: string | null;
  sortOrder?: number;
};

export type RuntimeTask = {
  id: string;
  sortOrder: number;
  sequenceIndex: number;
  company: CompanyData | null;
  aSubmittedAt: string | null;
  aUnlockedForBAt: string | null;
  bViewedAInfoAt: string | null;
  bCompletedAt: string | null;
};

export type QuestionnaireTemplate = {
  id: string;
  title: string;
  items: { id: string; prompt: string; options: string[] }[];
};

export type RuntimeState = {
  assignedRole: 'A' | 'B';
  phase: 'instruction' | 'practice_ready' | 'practice' | 'formal_ready' | 'formal_work' | 'formal_break' | 'end';
  segmentIndex: number;
  segmentType: 'PRACTICE' | 'WORK' | 'BREAK' | null;
  segmentRemainingSeconds: number | null;
  currentTask: RuntimeTask | null;
  taskRemainingSeconds: number | null;
  aInfoUnlocked: boolean;
  bHasViewedAInfo: boolean;
  bCanSubmit: boolean;
  isIdle: boolean;
  isFrozen: boolean;
  questionnaireSubmitted: boolean;
  aiLevel: 'BASIC' | 'ADVANCED';
  sideTaskQueue: Array<{
    planId: string;
    text: string;
    question: string;
    optionA: string;
    optionB: string;
    directAiFlag: boolean;
    narrativeCategory: string | null;
    queueOrder: number;
    batchNo: number | null;
    answered: boolean;
    answer: string | null;
  }>;
  sideTaskConfig: {
    dispatchMode: 'continuous' | 'batch';
    scrollDurationSec: number;
    holdSec: number;
    fadeSec: number;
    pauseSec: number;
    totalPlanned: number;
    totalReleased: number;
    totalAnswered: number;
    totalArchived: number;
    nextScheduledAt: string | null;
    pendingLabel: string;
    tickerMessage: string;
  };
  syncState: {
    barrier: 'practice' | 'formal';
    readyRoles: Array<'A' | 'B'>;
    readyCount: number;
    selfReady: boolean;
    waitingForPeer: boolean;
  } | null;
  questionnaireTemplate: QuestionnaireTemplate | null;
};

export type SessionBootstrap = {
  participantId: string;
  role: 'A' | 'B';
  sessionCode: string;
};

export type SessionStreamEvent = {
  type: string;
  data: unknown;
};

export function readSessionBootstrap(): SessionBootstrap | null {
  if (typeof window === 'undefined') return null;
  const participantId = sessionStorage.getItem('exp_participant_id');
  const role = sessionStorage.getItem('exp_role') as 'A' | 'B' | null;
  const sessionCode = sessionStorage.getItem('exp_session_code');
  if (!participantId || !role || !sessionCode) return null;
  return { participantId, role, sessionCode };
}

export function useSessionRuntime() {
  const [bootstrap, setBootstrap] = useState<SessionBootstrap | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [segmentCountdown, setSegmentCountdown] = useState<number | null>(null);
  const [taskCountdown, setTaskCountdown] = useState<number | null>(null);
  const [lastEvent, setLastEvent] = useState<SessionStreamEvent | null>(null);

  const applyRuntime = useCallback((data: RuntimeState) => {
    setRuntime(data);
    setSegmentCountdown(data.segmentRemainingSeconds ?? null);
    setTaskCountdown(data.taskRemainingSeconds ?? null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const nextBootstrap = readSessionBootstrap();
    if (!nextBootstrap) {
      setBootstrap(null);
      setRuntime(null);
      setLoading(false);
      return;
    }

    setBootstrap(nextBootstrap);
    const url = `${serverBaseUrl}/experiment/session/${nextBootstrap.sessionCode}/runtime?participantId=${nextBootstrap.participantId}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      setLoading(false);
      return;
    }

    const data = (await res.json()) as RuntimeState & { ok: boolean };
    applyRuntime(data);
  }, [applyRuntime]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!bootstrap) return;

    const streamUrl = `${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/events?participantId=${bootstrap.participantId}`;
    const source = new EventSource(streamUrl);

    source.addEventListener('runtime', (event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as RuntimeState & { ok: boolean };
        applyRuntime(payload);
        setLastEvent({ type: 'runtime', data: payload });
      } catch {
        // ignore malformed event payloads
      }
    });

    const forwardEvent = (type: string) => (event: Event) => {
      const message = event as MessageEvent<string>;
      let data: unknown = null;
      try {
        data = JSON.parse(message.data);
      } catch {
        data = message.data;
      }
      const nextEvent = { type, data };
      setLastEvent(nextEvent);
      window.dispatchEvent(new CustomEvent('session-stream-event', { detail: nextEvent }));
    };

    source.addEventListener('b_feedback_to_a', forwardEvent('b_feedback_to_a'));
    source.addEventListener('a_task_submitted', forwardEvent('a_task_submitted'));
    source.addEventListener('a_task_auto_submitted', forwardEvent('a_task_auto_submitted'));
    source.addEventListener('b_task_completed', forwardEvent('b_task_completed'));
    source.addEventListener('break_questionnaire_submitted', forwardEvent('break_questionnaire_submitted'));

    source.onerror = () => {
      source.close();
      void refresh();
    };

    return () => source.close();
  }, [applyRuntime, bootstrap, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSegmentCountdown((value) => (value === null ? null : Math.max(0, value - 1)));
      setTaskCountdown((value) => (value === null ? null : Math.max(0, value - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const countdownLabel = useMemo(() => formatSeconds(segmentCountdown), [segmentCountdown]);
  const taskCountdownLabel = useMemo(() => formatSeconds(taskCountdown), [taskCountdown]);

  return {
    bootstrap,
    runtime,
    loading,
    refresh,
    segmentCountdown,
    taskCountdown,
    countdownLabel,
    taskCountdownLabel,
    lastEvent,
  };
}

export function useTaskDraft(
  sessionCode?: string,
  taskId?: string,
  role?: 'A' | 'B',
  section: 'main' | 'feedback' = 'main',
) {
  const [draft, setDraft] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(sessionCode && taskId && role));

  const refresh = useCallback(async () => {
    if (!sessionCode || !taskId || !role) {
      setDraft(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const url = `${serverBaseUrl}/experiment/session/${sessionCode}/tasks/${taskId}/draft?role=${role}&section=${section}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load task draft');
      const data = (await res.json()) as { ok: boolean; payload: unknown };
      setDraft(data.payload ?? null);
    } finally {
      setLoading(false);
    }
  }, [role, section, sessionCode, taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handleSaved(event: Event) {
      const detail = (event as CustomEvent<{
        taskId?: string;
        role?: 'A' | 'B';
        section?: 'main' | 'feedback';
        payload?: unknown;
      }>).detail;
      if (!detail) return;
      if (detail.taskId !== taskId || detail.role !== role || (detail.section ?? 'main') !== section) return;
      setDraft(detail.payload ?? null);
      setLoading(false);
    }

    window.addEventListener('task-draft-saved', handleSaved as EventListener);
    return () => window.removeEventListener('task-draft-saved', handleSaved as EventListener);
  }, [role, section, taskId]);

  return { draft, loading, refresh, setDraft };
}

export function formatSeconds(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--:--';
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
