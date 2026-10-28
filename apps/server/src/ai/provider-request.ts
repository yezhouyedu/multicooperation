export class ProviderRequestError extends Error {
  constructor(readonly status: 'timeout' | 'cancelled') { super(status === 'timeout' ? 'AI请求超时，请稍后重试' : 'AI请求已取消'); }
}

// The deadline covers headers AND the entire response body, not just fetch().
export async function withProviderDeadline<T>(external: AbortSignal | undefined, timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(new ProviderRequestError('cancelled'));
  if (external?.aborted) throw new ProviderRequestError('cancelled');
  external?.addEventListener('abort', cancel, { once: true });
  let abortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abortListener = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', abortListener, { once: true });
  });
  const timer = setTimeout(() => controller.abort(new ProviderRequestError('timeout')), timeoutMs);
  try { return await Promise.race([run(controller.signal), aborted]); }
  finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', cancel);
    if (abortListener) controller.signal.removeEventListener('abort', abortListener);
  }
}
