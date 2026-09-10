import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { SUPABASE_CLIENT, SupabaseModule } from '../supabase/supabase.module';
import { ChatModule } from './chat.module';
import { ChatMessage } from './chat.types';

const integration = process.env.RUN_SUPABASE_INTEGRATION === '1' ? describe : describe.skip;

integration('Chat with local Supabase', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let base: string;
  const externalId = `chat-integration-${randomUUID()}`;
  const threads: string[] = [];
  const connections: AbortController[] = [];

  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
      throw new Error('Integration tests require local Supabase');
    }
    db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const module = await Test.createTestingModule({ imports: [SupabaseModule, ChatModule] })
      .overrideProvider(SUPABASE_CLIENT).useValue(db).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api/v1/chats`;
  });

  afterAll(async () => {
    for (const connection of connections) connection.abort();
    if (app) await app.close();
    if (db) {
      const check = ({ error }: { error: unknown }) => { if (error) throw error; };
      if (threads.length) {
        check(await db.from('messages').delete().in('thread_id', threads));
        check(await db.from('threads').delete().in('id', threads));
      }
      check(await db.from('users').delete().eq('external_id', externalId));
      await db.removeAllChannels();
    }
  });

  async function openStream(threadId: string) {
    const abort = new AbortController();
    connections.push(abort);
    const response = await fetch(`${base}/${threadId}/events`, {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]),
    });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    return {
      abort,
      async next(expectedType: string) {
        while (!buffer.includes('\n\n')) {
          const chunk = await reader.read().catch((cause: unknown) => {
            throw new Error(`Waiting for ${expectedType} for thread ${threadId}; buffered: ${buffer}`, { cause });
          });
          if (chunk.done) throw new Error('Stream ended before expected event');
          buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
          buffer = buffer.replace(/^\n+/, '');
        }
        const end = buffer.indexOf('\n\n');
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        return event;
      },
    };
  }

  it('resolves concurrent identities, retrieves full history, and isolates live streams', async () => {
    await Promise.all([1, 2].map(async () => {
      const response = await fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_id: externalId }),
      });
      expect(response.status).toBe(202);
      threads.push((await response.json() as { thread_id: string }).thread_id);
    }));
    const { data: users, error } = await db.from('users').select('id').eq('external_id', externalId);
    expect(error).toBeNull();
    expect(users).toHaveLength(1);

    const rows = Array.from({ length: 1001 }, (_, i) => ({
      id: randomUUID(), thread_id: threads[0], role: 'user', content: `History ${i}`,
      created_at: '2026-09-10T00:00:00Z',
    }));
    expect((await db.from('messages').insert(rows)).error).toBeNull();
    const history = await fetch(`${base}/${threads[0]}/messages`);
    expect(history.status).toBe(200);
    const actual = await history.json() as ChatMessage[];
    expect(actual).toHaveLength(rows.length);
    const expected = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    actual.forEach((message, i) => {
      expect({ ...message, created_at: new Date(message.created_at).toISOString() })
        .toEqual({ ...expected[i], created_at: new Date(expected[i].created_at).toISOString() });
    });

    const a = await openStream(threads[0]);
    const b = await openStream(threads[1]);
    const c = await openStream(threads[0]);
    expect(await a.next('ready')).toContain('event: ready');
    expect(await b.next('ready')).toContain('event: ready');
    expect(await c.next('ready')).toContain('event: ready');
    const first = { id: randomUUID(), thread_id: threads[0], role: 'assistant', content: 'First chat' };
    const second = { id: randomUUID(), thread_id: threads[1], role: 'assistant', content: 'Second chat' };
    expect((await db.from('messages').insert([first, second])).error).toBeNull();
    for (const [stream, message] of [[a, first], [b, second], [c, first]] as const) {
      // Replication can deliver earlier inserts still in flight; clients deduplicate
      // against history. Every received message must nevertheless belong to this chat.
      for (;;) {
        const event = await stream.next('message.created');
        expect(event).toContain('event: message.created');
        expect(event).toContain(`"thread_id":"${message.thread_id}"`);
        if (event.includes(`id: ${message.id}`)) break;
      }
    }
    a.abort.abort();
    b.abort.abort();
    c.abort.abort();
    for (let i = 0; i < 100 && db.getChannels().length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(db.getChannels()).toHaveLength(0);
  }, 30_000);
});
