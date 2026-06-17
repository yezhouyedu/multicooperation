const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type TimestampEventInput = {
  sessionCode: string;
  participantId?: string;
  eventType: string;
  role?: 'A' | 'B';
  taskAssignmentId?: string | null;
  companyId?: string | null;
  sideTaskPlanId?: string | null;
  phase?: 'practice' | 'formal' | 'PRACTICE' | 'FORMAL';
  segmentIndex?: number | null;
  payload?: Record<string, unknown>;
};

export function createClientEventId(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export async function recordTimestampEvent(input: TimestampEventInput) {
  if (!input.participantId) return;
  const payload = {
    ...(input.payload ?? {}),
    clientEventId: input.payload?.clientEventId ?? createClientEventId(input.eventType),
  };
  await fetch(`${serverBaseUrl}/experiment/session/${input.sessionCode}/timestamps/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId: input.participantId,
      eventType: input.eventType,
      clientTime: new Date().toISOString(),
      role: input.role,
      taskAssignmentId: input.taskAssignmentId ?? undefined,
      companyId: input.companyId ?? undefined,
      sideTaskPlanId: input.sideTaskPlanId ?? undefined,
      phase: input.phase,
      segmentIndex: input.segmentIndex ?? undefined,
      payload,
    }),
  }).catch(() => {});
}
