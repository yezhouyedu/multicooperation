'use client';

import { createClientEventId, recordTimestampEvent } from '@/lib/timestamp-events';
import { useCallback, useEffect, useRef } from 'react';

type ExposureContext = {
  sessionCode: string;
  participantId: string;
  taskAssignmentId: string;
  companyId: string;
  phase: 'practice' | 'formal';
  segmentIndex: number;
};

type ExposureInput = Partial<ExposureContext> & {
  activeItemKey?: string;
  aMaterialIds: string[];
  unlocked: boolean;
  enabled: boolean;
};

type ActiveExposure = ExposureContext & {
  exposureId: string;
  startPromise: Promise<boolean>;
};

export function useBAOriginalMaterialExposure(input: ExposureInput) {
  const inputRef = useRef(input);
  const activeExposureRef = useRef<ActiveExposure | null>(null);
  inputRef.current = input;

  const stopExposure = useCallback((endReason: string) => {
    const active = activeExposureRef.current;
    if (!active) return;
    activeExposureRef.current = null;
    void active.startPromise.then((started) =>
      started
        ? recordTimestampEvent({
            sessionCode: active.sessionCode,
            participantId: active.participantId,
            role: 'B',
            eventType: 'b_a_original_material_view_ended',
            taskAssignmentId: active.taskAssignmentId,
            companyId: active.companyId,
            phase: active.phase,
            segmentIndex: active.segmentIndex,
            payload: { exposureId: active.exposureId, endReason },
          })
        : false,
    );
  }, []);

  const syncExposure = useCallback((inactiveReason = 'view_state_changed') => {
    const current = inputRef.current;
    const hasContext = Boolean(
      current.sessionCode &&
      current.participantId &&
      current.taskAssignmentId &&
      current.companyId,
    );
    const shouldExpose = Boolean(
      hasContext &&
      current.enabled &&
      current.unlocked &&
      current.activeItemKey &&
      current.aMaterialIds.includes(current.activeItemKey) &&
      !document.hidden &&
      document.hasFocus(),
    );
    const active = activeExposureRef.current;
    const sameTask = Boolean(
      active &&
      active.sessionCode === current.sessionCode &&
      active.participantId === current.participantId &&
      active.taskAssignmentId === current.taskAssignmentId &&
      active.companyId === current.companyId,
    );

    if ((!shouldExpose || !sameTask) && active) stopExposure(inactiveReason);
    if (!shouldExpose || sameTask || !hasContext) return;

    const context: ExposureContext = {
      sessionCode: current.sessionCode!,
      participantId: current.participantId!,
      taskAssignmentId: current.taskAssignmentId!,
      companyId: current.companyId!,
      phase: current.phase ?? 'formal',
      segmentIndex: current.segmentIndex ?? 0,
    };
    const exposureId = createClientEventId('b-a-original-material-view');
    const startPromise = recordTimestampEvent({
      sessionCode: context.sessionCode,
      participantId: context.participantId,
      role: 'B',
      eventType: 'b_a_original_material_view_started',
      taskAssignmentId: context.taskAssignmentId,
      companyId: context.companyId,
      phase: context.phase,
      segmentIndex: context.segmentIndex,
      payload: { exposureId },
    });
    activeExposureRef.current = { ...context, exposureId, startPromise };
  }, [stopExposure]);

  useEffect(() => {
    syncExposure();
  }, [
    input.aMaterialIds,
    input.activeItemKey,
    input.companyId,
    input.enabled,
    input.participantId,
    input.phase,
    input.segmentIndex,
    input.sessionCode,
    input.taskAssignmentId,
    input.unlocked,
    syncExposure,
  ]);

  useEffect(() => {
    const onVisibility = () => syncExposure(document.hidden ? 'document_hidden' : 'document_visible');
    const onBlur = () => stopExposure('window_blur');
    const onFocus = () => window.setTimeout(() => syncExposure('window_focus'), 50);
    const onPageHide = () => stopExposure('page_hidden_or_unloaded');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onPageHide);
      stopExposure('component_unmounted');
    };
  }, [stopExposure, syncExposure]);
}
