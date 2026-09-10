import { Logger, MessageEvent } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ChatEventsService } from './chat-events.service';

describe('ChatEventsService', () => {
  let service: ChatEventsService;
  const db = { channel: jest.fn(), removeChannel: jest.fn() };
  const threadId = 'b0000000-0000-4000-8000-000000000001';
  const message = { id: 'm1', thread_id: threadId, role: 'assistant', content: 'Hello', created_at: '2026-09-10T00:00:00Z' };

  function channel() {
    let status: (status: string) => void;
    let insert: (payload: { new: typeof message }) => void;
    const result: {
      on: jest.Mock;
      subscribe: jest.Mock;
      status: (value: string) => void;
      insert: (value?: typeof message) => void;
    } = {
      on: jest.fn((_event, _filter, callback) => { insert = callback; return result; }),
      subscribe: jest.fn((callback) => { status = callback; return result; }),
      status: (value: string) => status(value),
      insert: (value = message) => insert({ new: value }),
    };
    db.channel.mockReturnValueOnce(result);
    return result;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    db.channel.mockReset();
    db.removeChannel.mockReset().mockResolvedValue('ok');
    service = new ChatEventsService(db as unknown as SupabaseClient);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('waits for subscription readiness, filters messages, and sends heartbeats', async () => {
    const source = channel();
    const events: MessageEvent[] = [];
    const subscription = service.events(threadId).subscribe((event) => events.push(event));
    expect(events).toEqual([]);
    expect(db.channel).toHaveBeenCalledWith(expect.any(String), {
      config: { postgres_changes_options: { wait: true, timeout: 10_000 } },
    });
    source.status('SUBSCRIBED');
    expect(events).toEqual([{ type: 'ready', data: { thread_id: threadId } }]);
    expect(source.on).toHaveBeenCalledWith('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}`,
    }, expect.any(Function));
    source.insert({ ...message, thread_id: 'another-thread' });
    source.insert();
    expect(events[1]).toEqual({ type: 'message.created', id: message.id, data: message });
    jest.advanceTimersByTime(25_000);
    expect(events[2]).toEqual({ type: 'heartbeat', data: {} });
    subscription.unsubscribe();
    await service.onModuleDestroy();
    expect(db.removeChannel).toHaveBeenCalledTimes(1);
    expect(db.removeChannel).toHaveBeenCalledWith(source);
    source.status('SUBSCRIBED');
    source.insert();
    expect(events).toHaveLength(3);
  });

  it.each([
    ['CHANNEL_ERROR', 'SUBSCRIPTION_FAILED'],
    ['TIMED_OUT', 'SUBSCRIPTION_TIMEOUT'],
    ['CLOSED', 'SUBSCRIPTION_CLOSED'],
  ])('closes and cleans up on %s', async (status, code) => {
    const source = channel();
    const next = jest.fn();
    const complete = jest.fn();
    service.events(threadId).subscribe({ next, complete });
    source.status(status);
    expect(next).toHaveBeenCalledWith({ type: 'stream.error', data: { code } });
    expect(complete).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
    expect(db.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('times out a subscription that never becomes ready', () => {
    channel();
    const next = jest.fn();
    const subscription = service.events(threadId).subscribe(next);
    jest.advanceTimersByTime(10_000);
    expect(next).toHaveBeenCalledWith({ type: 'stream.error', data: { code: 'SUBSCRIPTION_TIMEOUT' } });
    expect(subscription.closed).toBe(true);
  });

  it('cleans up if the client disconnects during startup', async () => {
    const source = channel();
    const next = jest.fn();
    service.events(threadId).subscribe(next).unsubscribe();
    source.status('SUBSCRIBED');
    jest.advanceTimersByTime(30_000);
    expect(next).not.toHaveBeenCalled();
    await service.onModuleDestroy();
    expect(db.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('uses independent channels for multiple clients of the same chat', async () => {
    const first = channel();
    const second = channel();
    const a = service.events(threadId).subscribe();
    const b = service.events(threadId).subscribe();
    expect(db.channel.mock.calls[0][0]).not.toBe(db.channel.mock.calls[1][0]);
    first.status('SUBSCRIBED');
    second.status('SUBSCRIBED');
    a.unsubscribe();
    await Promise.resolve();
    expect(db.removeChannel).toHaveBeenCalledWith(first);
    expect(db.removeChannel).not.toHaveBeenCalledWith(second);
    expect(b.closed).toBe(false);
    await service.onModuleDestroy();
    expect(b.closed).toBe(true);
    expect(db.removeChannel).toHaveBeenCalledWith(second);
  });

  it('closes an established stream when Realtime fails', () => {
    const source = channel();
    const next = jest.fn();
    const subscription = service.events(threadId).subscribe(next);
    source.status('SUBSCRIBED');
    source.status('CHANNEL_ERROR');
    expect(subscription.closed).toBe(true);
    expect(next).toHaveBeenLastCalledWith({ type: 'stream.error', data: { code: 'SUBSCRIPTION_FAILED' } });
  });

  it('sanitizes synchronous subscription errors and cleans up', async () => {
    const source = channel();
    source.subscribe.mockImplementation(() => { throw new Error('sensitive detail'); });
    const next = jest.fn();
    service.events(threadId).subscribe(next);
    expect(next).toHaveBeenCalledWith({ type: 'stream.error', data: { code: 'SUBSCRIPTION_FAILED' } });
    await service.onModuleDestroy();
    expect(db.removeChannel).toHaveBeenCalledWith(source);
  });
});
