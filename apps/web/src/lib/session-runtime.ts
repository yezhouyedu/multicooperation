'use client';

import {
  emitDraftSyncStatus,
  flushDraftQueue,
  getPendingDraftCount,
  loadLocalDraft,
  type DraftSection,
} from './draft-sync';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  usage?: 'formal' | 'practice';
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
  bViewedAMaterialsAt: string | null;
  bCompletedAt: string | null;
  aAiLevelAtWindow: 'BASIC' | 'ADVANCED' | null;
  bPreAAiLevel: 'BASIC' | 'ADVANCED' | null;
  bPostAAiLevel: 'BASIC' | 'ADVANCED' | null;
  crossUpgradeBoundaryFlag: boolean;
};

export type QuestionnaireItem = {
  id: string;
  code: string;
  prompt: string;
  type: 'scale' | 'single' | 'multi' | 'number' | 'text';
  required?: boolean;
  reverse?: boolean;
  construct?: string;
  order?: number;
  options: string[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  maxLength?: number;
  followup?: {
    prompt: string;
    triggerText: string;
  };
};

export type QuestionnaireTemplate = {
  id: string;
  title: string;
  kind?: 'segment_survey' | 'post_survey';
  templateVersion?: string;
  experimentMode?: 'manual' | 'ai_upgrade' | 'side_reminder' | 'coop_narrative';
  role?: 'A' | 'B';
  segmentIndex?: number;
  workSegment?: number | null;
  sections?: { title: string; items: QuestionnaireItem[] }[];
  items: QuestionnaireItem[];
};

export type RuntimeState = {
  assignedRole: 'A' | 'B';
  phase:
    | 'instruction'
    | 'practice_quiz'
    | 'practice_ready'
    | 'practice'
    | 'formal_ready'
    | 'pre_segment_instruction'
    | 'formal_work'
    | 'formal_break'
    | 'end';
  segmentIndex: number;
  segmentType: 'PRACTICE' | 'WORK' | 'BREAK' | null;
  segmentRemainingSeconds: number | null;
  currentTask: RuntimeTask | null;
  taskRemainingSeconds: number | null;
  aInfoUnlocked: boolean;
  bHasViewedAInfo: boolean;
  bHasViewedAMaterials: boolean;
  bCanSubmit: boolean;
  isIdle: boolean;
  isFrozen: boolean;
  isPreA: boolean;
  questionnaireSubmitted: boolean;
  experimentMode: 'manual' | 'ai_upgrade' | 'side_reminder' | 'coop_narrative';
  experimentSnapshot: Record<string, unknown> | null;
  instructionBlocks: {
    commonTitle: string;
    commonBody: string;
    roleA: string;
    roleB: string;
    manual: string;
    ai_upgrade: string;
    side_reminder: string;
    coop_narrative: string;
    aiUpgradeBreakNotice: string;
    aiUpgradeWorkspaceNotice: string;
    activeModeText: string;
  };
  aiLevel: 'BASIC' | 'ADVANCED';
  aiDisplayNames: {
    basic: string;
    advanced: string;
  };
  aiUpgradeNotice: { type: 'break' | 'workspace'; message: string } | null;
  feedbackNotificationDurationSec: number;
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
    notificationPulse: {
      id: string;
      reason: 'continuous_arrival' | 'batch_window';
      planIds: string[];
      newCount: number;
      windowStart: string | null;
      windowEnd: string | null;
    } | null;
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
  preSegmentInstruction: {
    workSegment: number;
    segmentIndex: number;
    title: string;
    instructionType: string;
    instructionTextId: string;
    instructionFamily: 'neutral' | 'coop';
    body: string;
    durationSeconds: number;
    openedAt: string | null;
    continueEnabledAt: string | null;
    remainingSeconds: number;
    selfCompleted: boolean;
    completedCount: number;
    participantCount: number;
    waitingForPeer: boolean;
  } | null;
  questionnaireTemplate: QuestionnaireTemplate | null;
  practiceQuizTemplate: QuestionnaireTemplate | null;
  practiceQuizPassCount: number;
  practiceQuizPassed: boolean;
  practiceTutorialState: {
    steps: string[];
    completedSteps: string[];
    completed: boolean;
  } | null;
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

export type RuntimeConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'polling' | 'offline';

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
  const [connectionStatus, setConnectionStatus] = useState<RuntimeConnectionStatus>('connecting');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [nextReconnectDelayMs, setNextReconnectDelayMs] = useState(0);
  const [pendingDraftCount, setPendingDraftCount] = useState(0);
  const lastEventIdRef = useRef<string | null>(null);

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

    setBootstrap((prev) =>
      prev?.participantId === nextBootstrap.participantId &&
      prev.role === nextBootstrap.role &&
      prev.sessionCode === nextBootstrap.sessionCode
        ? prev
        : nextBootstrap,
    );
    try {
      const url = `${serverBaseUrl}/experiment/session/${nextBootstrap.sessionCode}/runtime?participantId=${nextBootstrap.participantId}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = (await res.json()) as RuntimeState & { ok: boolean };
      applyRuntime(data);
    } catch {
      setLoading(false);
    }
  }, [applyRuntime]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!bootstrap) return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let attempt = 0;

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const startPolling = () => {
      if (pollTimer) return;
      setConnectionStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'polling');
      void refresh();
      pollTimer = setInterval(() => {
        void refresh();
      }, 5000);
    };

    const recordEventId = (event: Event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) lastEventIdRef.current = message.lastEventId;
    };

    const connect = () => {
      if (disposed) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnectionStatus('offline');
        startPolling();
        reconnectTimer = setTimeout(connect, 5000);
        setNextReconnectDelayMs(5000);
        return;
      }

      const params = new URLSearchParams({ participantId: bootstrap.participantId });
      if (lastEventIdRef.current) params.set('lastEventId', lastEventIdRef.current);
      const streamUrl = `${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/events?${params}`;
      source = new EventSource(streamUrl);
      setConnectionStatus(attempt > 0 ? 'reconnecting' : 'connecting');
      setReconnectAttempt(attempt);

      source.addEventListener('open', () => {
        attempt = 0;
        setReconnectAttempt(0);
        setNextReconnectDelayMs(0);
        setConnectionStatus('connected');
        stopPolling();
        void flushDraftQueue().then(setPendingDraftCount);
      });

      source.addEventListener('runtime', (event) => {
        recordEventId(event);
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
      recordEventId(event);
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
      source.addEventListener('practice_a_task_auto_submitted', forwardEvent('practice_a_task_auto_submitted'));
      source.addEventListener('b_task_completed', forwardEvent('b_task_completed'));
      source.addEventListener('practice_b_task_completed', forwardEvent('practice_b_task_completed'));
      source.addEventListener('break_questionnaire_submitted', forwardEvent('break_questionnaire_submitted'));
      source.addEventListener('segment_survey_submitted', forwardEvent('segment_survey_submitted'));
      source.addEventListener('post_survey_submitted', forwardEvent('post_survey_submitted'));

      source.onerror = () => {
        source?.close();
        attempt += 1;
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt - 1, 5));
        setConnectionStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'polling');
        setReconnectAttempt(attempt);
        setNextReconnectDelayMs(delay);
        startPolling();
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
    };
  }, [applyRuntime, bootstrap, refresh]);

  useEffect(() => {
    const updateDraftCount = () => {
      void getPendingDraftCount().then(setPendingDraftCount).catch(() => setPendingDraftCount(0));
    };
    const handleOnline = () => {
      setConnectionStatus((status) => (status === 'offline' ? 'reconnecting' : status));
      void flushDraftQueue().then(setPendingDraftCount);
      void refresh();
    };
    const handleOffline = () => {
      setConnectionStatus('offline');
      updateDraftCount();
    };
    const handleDraftStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ pendingCount?: number }>).detail;
      if (typeof detail?.pendingCount === 'number') setPendingDraftCount(detail.pendingCount);
      else updateDraftCount();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('draft-sync-status', handleDraftStatus as EventListener);
    updateDraftCount();
    void emitDraftSyncStatus();
    if (typeof navigator !== 'undefined' && !navigator.onLine) setConnectionStatus('offline');
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('draft-sync-status', handleDraftStatus as EventListener);
    };
  }, [refresh]);

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
    connectionStatus,
    reconnectAttempt,
    nextReconnectDelayMs,
    pendingDraftCount,
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
      const local = await loadLocalDraft(sessionCode, taskId, role, section as DraftSection).catch(() => null);
      setDraft(data.payload ?? local?.payload ?? null);
    } catch {
      const local = await loadLocalDraft(sessionCode, taskId, role, section as DraftSection).catch(() => null);
      setDraft(local?.payload ?? null);
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
