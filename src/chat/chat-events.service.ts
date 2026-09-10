import { Inject, Injectable, Logger, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { ChatEvent } from './chat.types';

@Injectable()
export class ChatEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatEventsService.name);
  private readonly streams = new Set<() => void>();
  private readonly removals = new Set<Promise<void>>();
  private shuttingDown = false;

  constructor(@Inject(SUPABASE_CLIENT) private readonly db: SupabaseClient) {}

  events(threadId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      if (this.shuttingDown) {
        subscriber.complete();
        return;
      }

      let channel: RealtimeChannel | undefined;
      let startup: ReturnType<typeof setTimeout> | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let ready = false;
      let closed = false;
      const emit = (event: ChatEvent) => subscriber.next(event);
      const stop = () => subscriber.complete();
      this.streams.add(stop);

      subscriber.add(() => {
        closed = true;
        clearTimeout(startup);
        clearInterval(heartbeat);
        this.streams.delete(stop);
        if (channel) this.removeChannel(channel);
      });

      const fail = (code: 'SUBSCRIPTION_FAILED' | 'SUBSCRIPTION_TIMEOUT' | 'SUBSCRIPTION_CLOSED') => {
        if (closed) return;
        this.logger.warn({ threadId, code });
        emit({ type: 'stream.error', data: { code } });
        subscriber.complete();
      };

      try {
        channel = this.db.channel(`chat:${threadId}:${randomUUID()}`, {
          config: { postgres_changes_options: { wait: true, timeout: 10_000 } },
        });
        startup = setTimeout(() => fail('SUBSCRIPTION_TIMEOUT'), 10_000);
        channel.on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}`,
        }, (payload) => {
          if (closed || !ready || payload.new.thread_id !== threadId) return;
          const { id, thread_id, role, content, created_at } = payload.new;
          emit({ type: 'message.created', id, data: { id, thread_id, role, content, created_at } });
        }).subscribe((status) => {
          if (closed) return;
          if (status === 'SUBSCRIBED' && !ready) {
            ready = true;
            clearTimeout(startup);
            emit({ type: 'ready', data: { thread_id: threadId } });
            if (!closed) heartbeat = setInterval(() => emit({ type: 'heartbeat', data: {} }), 25_000);
          } else if (status === 'TIMED_OUT') {
            fail('SUBSCRIPTION_TIMEOUT');
          } else if (status === 'CHANNEL_ERROR') {
            fail('SUBSCRIPTION_FAILED');
          } else if (status === 'CLOSED') {
            fail('SUBSCRIPTION_CLOSED');
          }
        });
      } catch {
        fail('SUBSCRIPTION_FAILED');
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    for (const stop of this.streams) stop();
    await Promise.all(this.removals);
  }

  private removeChannel(channel: RealtimeChannel): void {
    const removal = Promise.resolve().then(() => this.db.removeChannel(channel))
      .then((status) => {
        if (status !== 'ok') this.logger.warn(`Realtime channel cleanup: ${status}`);
      }).catch(() => { this.logger.warn('Realtime channel cleanup failed'); });
    this.removals.add(removal);
    void removal.then(() => this.removals.delete(removal));
  }
}
