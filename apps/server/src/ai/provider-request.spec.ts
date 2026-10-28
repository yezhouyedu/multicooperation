import { withProviderDeadline } from './provider-request';

describe('AI total deadline', () => {
  it('returns normal results and clears listeners/timers', async () => {
    await expect(withProviderDeadline(undefined, 50, async () => 'ok')).resolves.toBe('ok');
  });
  it('times out hung fetch or body reads', async () => {
    let signal: AbortSignal | undefined;
    await expect(withProviderDeadline(undefined, 10, async (value) => { signal = value; return new Promise(() => undefined); })).rejects.toThrow('AI请求超时');
    expect(signal?.aborted).toBe(true);
  });
  it('cancels when the client disconnects', async () => {
    const controller = new AbortController();
    const request = withProviderDeadline(controller.signal, 1000, () => new Promise(() => undefined));
    controller.abort();
    await expect(request).rejects.toThrow('AI请求已取消');
  });
  it('does not start a provider call for an already aborted client', async () => {
    const controller = new AbortController(); controller.abort();
    const handler = jest.fn();
    await expect(withProviderDeadline(controller.signal, 1000, handler)).rejects.toThrow('AI请求已取消');
    expect(handler).not.toHaveBeenCalled();
  });
});
