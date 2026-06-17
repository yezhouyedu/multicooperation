'use client';

export function createIdempotencyKey(scope: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${random}`;
}

export function idempotencyHeaders(scope: string, headers?: HeadersInit) {
  const next = new Headers(headers);
  next.set('Idempotency-Key', createIdempotencyKey(scope));
  return next;
}
