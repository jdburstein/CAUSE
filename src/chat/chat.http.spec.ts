import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SUPABASE_CLIENT, SupabaseModule } from '../supabase/supabase.module';
import { ChatModule } from './chat.module';

const userId = 'a0000000-0000-4000-8000-000000000001';
const threadId = 'b0000000-0000-4000-8000-000000000001';

describe('Chat HTTP endpoints', () => {
  let app: INestApplication;
  let base: string;
  const db = { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn().mockResolvedValue('ok') };

  function query(table: string, data: unknown, error: unknown = null) {
    const builder: Record<string, jest.Mock> = {};
    for (const method of ['select', 'eq', 'insert', 'order', 'range', 'single', 'maybeSingle']) {
      builder[method] = jest.fn().mockReturnValue(builder);
    }
    builder.then = jest.fn((resolve) => Promise.resolve({ data, error }).then(resolve));
    db.from.mockImplementationOnce((name: string) => {
      expect(name).toBe(table);
      return builder;
    });
    return builder;
  }

  async function create(body: unknown) {
    return fetch(`${base}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [SupabaseModule, ChatModule] })
      .overrideProvider(SUPABASE_CLIENT).useValue(db).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api/v1`;
  });

  beforeEach(() => db.from.mockReset());
  afterAll(async () => { await app.close(); });

  it.each([
    {}, { user_id: null }, { external_id: null }, { user_id: 'invalid' },
    { external_id: '' }, { external_id: '  ' }, { external_id: 123 },
    { external_id: 'U1', title: 'Unexpected' },
  ])('rejects invalid creation input %j', async (input) => {
    const response = await create(input);
    expect(response.status).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each([{ user_id: userId }, { user_id: userId, external_id: 'U1' }])(
    'creates an empty thread for an existing user %j', async (input) => {
      query('users', { id: userId, external_id: 'U1' });
      const thread = query('threads', { id: threadId });
      const response = await create(input);
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ thread_id: threadId });
      expect(thread.insert).toHaveBeenCalledWith({ user_id: userId });
    },
  );

  it('resolves an existing external identity without inserting a user', async () => {
    query('users', { id: userId });
    query('threads', { id: threadId });
    expect((await create({ external_id: 'U1' })).status).toBe(202);
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it('creates a user from a new external identity', async () => {
    query('users', null);
    const user = query('users', { id: userId });
    query('threads', { id: threadId });
    expect((await create({ external_id: 'U1' })).status).toBe(202);
    expect(user.insert).toHaveBeenCalledWith({ external_id: 'U1' });
  });

  it('recovers from another request creating the external identity', async () => {
    query('users', null);
    query('users', null, { code: '23505' });
    query('users', { id: userId });
    query('threads', { id: threadId });
    expect((await create({ external_id: 'U1' })).status).toBe(202);
  });

  it('returns 404 for an unknown user ID without creating a user', async () => {
    query('users', null);
    expect((await create({ user_id: userId, external_id: 'U1' })).status).toBe(404);
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it('rejects conflicting identifiers', async () => {
    query('users', { id: userId, external_id: 'U2' });
    expect((await create({ user_id: userId, external_id: 'U1' })).status).toBe(409);
  });

  it.each(['users', 'threads'])('sanitizes %s database failures', async (table) => {
    if (table === 'threads') query('users', { id: userId });
    query(table, null, { message: 'sensitive database detail' });
    const response = await create({ user_id: userId });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('sensitive');
  });

  it('rejects an invalid thread UUID', async () => {
    expect((await fetch(`${base}/chats/invalid/messages`)).status).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('returns 404 for missing threads', async () => {
    query('threads', null);
    expect((await fetch(`${base}/chats/${threadId}/messages`)).status).toBe(404);
  });

  it('returns an empty array for an empty thread', async () => {
    query('threads', { id: threadId });
    query('messages', []);
    const response = await fetch(`${base}/chats/${threadId}/messages`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('reads beyond the database page limit with stable ordering and a thread filter', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      id: String(i), thread_id: threadId, role: 'user', content: `Message ${i}`,
      created_at: '2026-09-10T00:00:00Z',
    }));
    query('threads', { id: threadId });
    const first = query('messages', rows.slice(0, 1000));
    const second = query('messages', rows.slice(1000));
    query('messages', []);
    const response = await fetch(`${base}/chats/${threadId}/messages`);
    expect(await response.json()).toEqual(rows);
    expect(first.eq).toHaveBeenCalledWith('thread_id', threadId);
    expect(first.order.mock.calls).toEqual([
      ['created_at', { ascending: true }], ['id', { ascending: true }],
    ]);
    expect(first.range).toHaveBeenCalledWith(0, 999);
    expect(second.range).toHaveBeenCalledWith(1000, 1999);
  });

  it('sanitizes message query failures', async () => {
    query('threads', { id: threadId });
    query('messages', null, { message: 'sensitive detail' });
    const response = await fetch(`${base}/chats/${threadId}/messages`);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('sensitive');
  });

  it('validates SSE IDs before opening a stream', async () => {
    const invalid = await fetch(`${base}/chats/invalid/events`);
    expect(invalid.status).toBe(400);
    query('threads', null);
    const missing = await fetch(`${base}/chats/${threadId}/events`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('content-type')).toContain('application/json');
    expect(db.channel).not.toHaveBeenCalled();
  });

  it('frames SSE events and cleans up when the HTTP client disconnects', async () => {
    query('threads', { id: threadId });
    let onInsert: (payload: { new: Record<string, unknown> }) => void;
    const source: { on: jest.Mock; subscribe: jest.Mock } = {
      on: jest.fn((_event, _filter, callback) => { onInsert = callback; return source; }),
      subscribe: jest.fn((callback) => { callback('SUBSCRIBED'); return source; }),
    };
    db.channel.mockReturnValueOnce(source);
    const abort = new AbortController();
    const response = await fetch(`${base}/chats/${threadId}/events`, { signal: abort.signal });
    try {
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('event: ready')) text += decoder.decode((await reader.read()).value);
      expect(text).toContain(`data: {"thread_id":"${threadId}"}`);
      onInsert!({ new: { id: 'message-id', thread_id: threadId, role: 'assistant', content: 'Hello', created_at: '2026-09-10T00:00:00Z' } });
      while (!text.includes('event: message.created')) text += decoder.decode((await reader.read()).value);
      expect(text).toContain('id: message-id');
      expect(text).toContain('"content":"Hello"');
    } finally {
      abort.abort();
    }
    for (let i = 0; i < 20 && db.removeChannel.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(db.removeChannel).toHaveBeenCalledWith(source);
  });
});
