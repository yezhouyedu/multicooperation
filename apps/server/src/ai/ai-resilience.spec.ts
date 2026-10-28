import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AI failure and cancellation audit', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
  function fixture() {
    const service = new AiService(new ConfigService(), {} as never, {} as never, {} as never);
    const internal = service as any;
    internal.resolveChatContext = jest.fn().mockResolvedValue({ endpoint: 'https://invalid.example/provider', apiKey: 'fake', model: 'fake-model', requestId: 'test', historyMessages: [], userMessage: { role: 'user', content: 'test' } });
    internal.persistUserMessage = jest.fn(); internal.recordAiWaitStarted = jest.fn();
    internal.persistAssistantMessage = jest.fn().mockResolvedValue({ id: 'response', createdAt: new Date() });
    internal.recordAiEvent = jest.fn();
    return { service, internal };
  }
  it('audits a provider network error once and closes the wait', async () => {
    const { service, internal } = fixture();
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    await expect(service.chatStream({ sessionCode: 'test' })).rejects.toThrow('network down');
    expect(internal.recordAiEvent).toHaveBeenCalledTimes(1);
    expect(internal.recordAiEvent.mock.calls[0][2]).toBe('error');
  });
  it('records cancellation and does not announce completion', async () => {
    const { service, internal } = fixture();
    const controller = new AbortController();
    const done = jest.fn();
    global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      controller.abort();
    })) as typeof fetch;
    await expect(service.chatStream({ sessionCode: 'test' }, { onDone: done }, controller.signal)).rejects.toThrow('AI请求已取消');
    expect(done).not.toHaveBeenCalled();
    expect(internal.recordAiEvent.mock.calls[0][2]).toBe('cancelled');
  });
  it('enforces total timeout while non-streaming body is hung', async () => {
    jest.useFakeTimers();
    const { service, internal } = fixture();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => undefined) });
    const request = service.chat({ sessionCode: 'test' });
    const assertion = expect(request).rejects.toThrow('AI请求超时');
    await jest.advanceTimersByTimeAsync(180001);
    await assertion;
    expect(internal.recordAiEvent.mock.calls[0][2]).toBe('timeout');
  });
  it('retains streamed partial text as an error, not a completed answer', async () => {
    const { service, internal } = fixture();
    let count = 0;
    const cancel = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: { getReader: () => ({
      read: async () => { if (count++) throw new Error('stream disconnected'); return { done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n') }; },
      cancel: async () => cancel(), releaseLock: jest.fn(),
    }) } });
    const done = jest.fn();
    await expect(service.chatStream({ sessionCode: 'test' }, { onDone: done })).rejects.toThrow('stream disconnected');
    expect(internal.persistAssistantMessage.mock.calls[0][1]).toBe('partial');
    expect(internal.persistAssistantMessage.mock.calls[0][2].providerStatus).toBe('error');
    expect(done).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalled();
  });
  it('handles a final SSE line without newline', async () => {
    const { service, internal } = fixture();
    global.fetch = jest.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"complete"}}]}'));
    const done = jest.fn();
    await service.chatStream({ sessionCode: 'test' }, { onDone: done });
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ reply: 'complete' }));
    expect(internal.recordAiEvent.mock.calls[0][2]).toBe('provider');
  });
});
