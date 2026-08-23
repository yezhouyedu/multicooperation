'use client';

import { idempotencyHeaders } from '@/lib/idempotency';
import type { RuntimeState, SessionBootstrap } from '@/lib/session-runtime';
import { useCallback, useEffect, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type Props = { bootstrap: SessionBootstrap | null; runtime: RuntimeState | null };
type PromptState = 'none' | 'confirm' | 'invalid';

export function OnlineIntegrityGuard({ bootstrap, runtime }: Props) {
  const active = Boolean(bootstrap && runtime?.phase === 'formal_work' && runtime.onlineIntegrity.config.enabled);
  const config = runtime?.onlineIntegrity.config;
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [promptState, setPromptState] = useState<PromptState>('none');
  const [promptSeconds, setPromptSeconds] = useState(0);
  const [showQuit, setShowQuit] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const promptShownAtRef = useRef<number | null>(null);
  const inactivityIntervalIdRef = useRef<string | null>(null);
  const inactivityStartPromiseRef = useRef<Promise<{ intervalId?: string } | null> | null>(null);
  const offscreenIntervalIdRef = useRef<string | null>(null);
  const offscreenStartPromiseRef = useRef<Promise<{ intervalId?: string } | null> | null>(null);
  const offscreenActiveRef = useRef(false);
  const lastOffscreenEndedAtRef = useRef<number | null>(null);
  const authorizedDialogUntilRef = useRef(0);
  const lastCopyHashRef = useRef<string | null>(null);
  const currentTaskRef = useRef(runtime?.currentTask ?? null);
  currentTaskRef.current = runtime?.currentTask ?? null;

  const postEvent = useCallback(async (eventType: string, payload: Record<string, unknown> = {}, intervalId?: string) => {
    if (!bootstrap) return null;
    const response = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ participantId: bootstrap.participantId, eventType, intervalId, clientTime: new Date().toISOString(), payload }),
    }).catch(() => null);
    if (!response?.ok) return null;
    return response.json().catch(() => null) as Promise<{ intervalId?: string } | null>;
  }, [bootstrap]);

  const restoreFullscreen = useCallback(async () => {
    setFullscreenError('');
    if (!config?.fullscreenRequired) {
      setFullscreenBlocked(false);
      return;
    }
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      if (!document.fullscreenElement) throw new Error('浏览器未进入全屏');
      setFullscreenBlocked(false);
    } catch {
      setFullscreenError('浏览器拒绝了全屏请求。请允许全屏，或改用最新版 Chrome / Edge 后重试。');
    }
  }, [config?.fullscreenRequired]);

  const closeInactivity = useCallback((endReason: string) => {
    const intervalId = inactivityIntervalIdRef.current ?? undefined;
    if (promptShownAtRef.current !== null || intervalId) {
      void postEvent('inactivity_ended', { endReason }, intervalId);
    }
    inactivityIntervalIdRef.current = null;
    promptShownAtRef.current = null;
    setPromptState('none');
    lastActivityRef.current = Date.now();
  }, [postEvent]);

  useEffect(() => {
    if (!active || !bootstrap || !config) {
      setFullscreenBlocked(false);
      setPromptState('none');
      return;
    }

    lastActivityRef.current = Date.now();
    setFullscreenBlocked(config.fullscreenRequired && !document.fullscreenElement);

    const heartbeat = () => {
      void fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/integrity/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ participantId: bootstrap.participantId, clientTime: new Date().toISOString(), lastValidActivityAt: new Date(lastActivityRef.current).toISOString() }),
      }).catch(() => {});
    };
    heartbeat();
    const heartbeatTimer = window.setInterval(heartbeat, config.heartbeatIntervalSeconds * 1000);

    const startOffscreen = () => {
      if (offscreenActiveRef.current) return;
      offscreenActiveRef.current = true;
      const authorizedDialog = Date.now() <= authorizedDialogUntilRef.current;
      const startPromise = postEvent('offscreen_started', {
        triggerReason: document.hidden ? 'document_hidden' : 'window_blur',
        authorizedDialog,
        taskAssignmentId: currentTaskRef.current?.id ?? null,
        companyId: currentTaskRef.current?.company?.id ?? null,
      });
      offscreenStartPromiseRef.current = startPromise;
      void startPromise.then((result) => { offscreenIntervalIdRef.current = result?.intervalId ?? null; });
    };
    const endOffscreen = async () => {
      if (!offscreenActiveRef.current || document.hidden || !document.hasFocus()) return;
      offscreenActiveRef.current = false;
      lastOffscreenEndedAtRef.current = Date.now();
      const started = offscreenStartPromiseRef.current ? await offscreenStartPromiseRef.current : null;
      const intervalId = offscreenIntervalIdRef.current ?? started?.intervalId ?? undefined;
      offscreenIntervalIdRef.current = null;
      offscreenStartPromiseRef.current = null;
      await postEvent('offscreen_ended', { endReason: 'page_visible_and_focused' }, intervalId);
      setFullscreenBlocked(config.fullscreenRequired && !document.fullscreenElement);
    };
    const onVisibility = () => { if (document.hidden) startOffscreen(); else window.setTimeout(() => void endOffscreen(), 50); };
    const onBlur = () => startOffscreen();
    const onFocus = () => window.setTimeout(() => void endOffscreen(), 50);
    const onFullscreen = () => { if (config.fullscreenRequired && !document.fullscreenElement) setFullscreenBlocked(true); };
    const onAuthorizedDialog = () => { authorizedDialogUntilRef.current = Date.now() + 2000; };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('experiment-authorized-file-dialog', onAuthorizedDialog);

    const idleTimer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (promptShownAtRef.current === null && idleMs >= config.idlePromptSeconds * 1000) {
        promptShownAtRef.current = Date.now();
        setPromptState('confirm');
        setPromptSeconds(config.idleConfirmationGraceSeconds);
        void postEvent('idle_prompt_shown', { idleCountdownStartedAt: new Date(lastActivityRef.current).toISOString() });
        return;
      }
      if (promptShownAtRef.current !== null && inactivityIntervalIdRef.current === null) {
        const remaining = Math.max(0, Math.ceil((promptShownAtRef.current + config.idleConfirmationGraceSeconds * 1000 - Date.now()) / 1000));
        setPromptSeconds(remaining);
        if (remaining === 0) {
          setPromptState('invalid');
          const startPromise = postEvent('inactivity_started', {
            triggerReason: 'idle_prompt_timeout',
            idleCountdownStartedAt: new Date(lastActivityRef.current).toISOString(),
            promptShownAt: new Date(promptShownAtRef.current).toISOString(),
            confirmationDeadlineAt: new Date(promptShownAtRef.current + config.idleConfirmationGraceSeconds * 1000).toISOString(),
            taskAssignmentId: currentTaskRef.current?.id ?? null,
            companyId: currentTaskRef.current?.company?.id ?? null,
          });
          inactivityStartPromiseRef.current = startPromise;
          void startPromise.then((result) => { inactivityIntervalIdRef.current = result?.intervalId ?? null; });
        }
      }
    }, 500);

    const validActivity = (event: Event) => {
      if (!event.isTrusted) return;
      if (promptShownAtRef.current !== null) return;
      if (inactivityIntervalIdRef.current) closeInactivity('valid_activity');
      else lastActivityRef.current = Date.now();
    };
    ['keydown', 'pointerdown', 'input', 'wheel', 'touchstart'].forEach((name) => document.addEventListener(name, validActivity, { passive: true }));

    const hashText = async (text: string) => {
      const bytes = new TextEncoder().encode(`${bootstrap.sessionCode}:${text}`);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    };
    const onCopy = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain') || document.getSelection()?.toString() || '';
      if (!text) return;
      void hashText(text).then((contentHash) => {
        lastCopyHashRef.current = contentHash;
        void postEvent('clipboard_copy', { charCount: text.length, contentHash, classification: 'platform_internal', afterOffscreen: false });
      });
    };
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain') || '';
      void hashText(text).then((contentHash) => {
        const afterOffscreen = Boolean(lastOffscreenEndedAtRef.current && Date.now() - lastOffscreenEndedAtRef.current <= config.pasteAfterOffscreenWindowSeconds * 1000);
        void postEvent('clipboard_paste', { charCount: text.length, contentHash, classification: contentHash === lastCopyHashRef.current ? 'platform_internal' : 'platform_external', afterOffscreen });
      });
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);

    const onBeforeUnload = () => {
      const blob = new Blob([JSON.stringify({ participantId: bootstrap.participantId, clientTime: new Date().toISOString(), lastValidActivityAt: new Date(lastActivityRef.current).toISOString() })], { type: 'application/json' });
      navigator.sendBeacon?.(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/integrity/heartbeat`, blob);
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.clearInterval(heartbeatTimer);
      window.clearInterval(idleTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('experiment-authorized-file-dialog', onAuthorizedDialog);
      ['keydown', 'pointerdown', 'input', 'wheel', 'touchstart'].forEach((name) => document.removeEventListener(name, validActivity));
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (offscreenActiveRef.current) void postEvent('offscreen_ended', { endReason: 'formal_work_component_unmounted' }, offscreenIntervalIdRef.current ?? undefined);
      if (inactivityIntervalIdRef.current) void postEvent('inactivity_ended', { endReason: 'formal_work_component_unmounted' }, inactivityIntervalIdRef.current);
      offscreenActiveRef.current = false;
      offscreenIntervalIdRef.current = null;
      offscreenStartPromiseRef.current = null;
      inactivityIntervalIdRef.current = null;
      inactivityStartPromiseRef.current = null;
    };
  }, [
    active,
    bootstrap,
    closeInactivity,
    config?.authorizedDialogMaxSeconds,
    config?.connectionLostGraceSeconds,
    config?.dropoutTimeoutSeconds,
    config?.fullscreenRequired,
    config?.heartbeatIntervalSeconds,
    config?.idleConfirmationGraceSeconds,
    config?.idlePromptSeconds,
    config?.offscreenViolationSeconds,
    config?.pasteAfterOffscreenWindowSeconds,
    postEvent,
  ]);

  async function confirmStillPresent() {
    if (promptState === 'invalid' && inactivityStartPromiseRef.current) {
      const started = await inactivityStartPromiseRef.current;
      inactivityIntervalIdRef.current = inactivityIntervalIdRef.current ?? started?.intervalId ?? null;
      inactivityStartPromiseRef.current = null;
    }
    await postEvent('idle_prompt_confirmed', { promptShownAt: promptShownAtRef.current ? new Date(promptShownAtRef.current).toISOString() : null });
    closeInactivity('participant_confirmed');
  }

  async function quitExperiment() {
    if (!bootstrap) return;
    setQuitting(true);
    await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/integrity/quit`, {
      method: 'POST',
      headers: idempotencyHeaders(`formal-quit:${bootstrap.sessionCode}:${bootstrap.participantId}`, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ participantId: bootstrap.participantId, reason: 'participant_confirmed_quit' }),
    }).catch(() => null);
    setShowQuit(false);
    setQuitting(false);
  }

  useEffect(() => {
    if (!active || !bootstrap || !runtime || runtime.onlineIntegrity.outcome === 'ACTIVE') return;
    const key = `partner-dropout-notice:${bootstrap.sessionCode}:${runtime.onlineIntegrity.outcome}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void postEvent('partner_dropout_notice_shown', { outcome: runtime.onlineIntegrity.outcome });
  }, [active, bootstrap, postEvent, runtime]);

  if (!runtime || !config) return null;
  const outcome = runtime.onlineIntegrity.outcome;
  const stopped = outcome === 'SELF_DROPPED' || outcome === 'STOP_AFTER_A_DROPOUT';
  if (!active && !stopped) return null;

  return (
    <>
      {outcome === 'CONTINUE_AFTER_B_DROPOUT' ? <div className="fixed left-1/2 top-16 z-[95] -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 shadow-lg">你的队友已退出实验。请继续完成剩余任务，系统已忠实记录该情况。</div> : null}
      {!stopped ? <button type="button" onClick={() => setShowQuit(true)} className="fixed bottom-4 right-4 z-[90] rounded border border-red-200 bg-white px-3 py-2 text-xs text-red-600 shadow">退出实验</button> : null}
      {fullscreenBlocked && !stopped ? <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/80 p-6"><div className="max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><h2 className="text-xl font-bold">请恢复实验全屏</h2><p className="mt-3 text-sm leading-6 text-[#4e5969]">正式工作段必须保持全屏。退出全屏本身不记为违规；如果实验页面失焦或被隐藏，会单独记录为切屏区间。</p>{fullscreenError ? <p className="mt-3 text-sm text-red-600">{fullscreenError}</p> : null}<button type="button" onClick={() => void restoreFullscreen()} className="mt-5 rounded-lg bg-[#1e80ff] px-5 py-2.5 font-semibold text-white">恢复全屏并继续</button></div></div> : null}
      {promptState !== 'none' && !stopped ? <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/75 p-6"><div className="max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><h2 className="text-xl font-bold">仍在参与实验吗？</h2><p className="mt-3 text-sm leading-6 text-[#4e5969]">{promptState === 'confirm' ? `请在 ${promptSeconds} 秒内确认。及时确认只记录一次软提醒，不判为无效行为。` : '已开启无效行为区间。点击继续会关闭区间，但本次无效标记会保留。'}</p><button type="button" onClick={() => void confirmStillPresent()} className="mt-5 rounded-lg bg-[#1e80ff] px-5 py-2.5 font-semibold text-white">我仍在参与，继续实验</button></div></div> : null}
      {showQuit ? <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/75 p-6"><div className="max-w-md rounded-2xl bg-white p-7"><h2 className="text-xl font-bold">确认正式退出实验？</h2><p className="mt-3 text-sm leading-6 text-[#4e5969]">退出会立即记录且不可恢复。A 退出后 B 将停止；B 退出后 A 仍会继续完成任务。</p><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setShowQuit(false)} className="rounded border px-4 py-2">取消</button><button type="button" disabled={quitting} onClick={() => void quitExperiment()} className="rounded bg-red-600 px-4 py-2 font-semibold text-white">{quitting ? '正在退出...' : '确认退出'}</button></div></div></div> : null}
      {stopped ? <div className="fixed inset-0 z-[130] grid place-items-center bg-[#f0f2f5] p-6"><div className="max-w-xl rounded-2xl border bg-white p-8 text-center shadow-xl"><h1 className="text-2xl font-bold">实验已结束</h1><p className="mt-4 leading-7 text-[#4e5969]">{outcome === 'STOP_AFTER_A_DROPOUT' ? '你的队友 A 已正式退出，本次协作实验不能继续。系统已保存双方此前的全部行为记录。' : '你已正式退出实验。系统已保存退出前的行为记录。'}</p><p className="mt-3 text-sm text-[#86909c]">请联系实验人员完成后续说明与报酬确认。</p></div></div> : null}
    </>
  );
}
