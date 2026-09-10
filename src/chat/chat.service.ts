import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { databaseError } from '../supabase/database-error';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { UsersService } from '../users/users.service';
import { CreateChatDto } from './create-chat.dto';
import { ChatMessage, CreatedChat } from './chat.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: SupabaseClient,
    private readonly users: UsersService,
  ) {}

  async create(input: CreateChatDto): Promise<CreatedChat> {
    const userId = await this.users.resolve(input);
    const { data, error } = await this.db.from('threads')
      .insert({ user_id: userId }).select('id').single();
    if (error || !data) databaseError(this.logger, 'Create thread', error);
    return { thread_id: data.id };
  }

  async assertExists(id: string): Promise<void> {
    const { data, error } = await this.db.from('threads')
      .select('id').eq('id', id).maybeSingle();
    if (error) databaseError(this.logger, 'Find thread', error);
    if (!data) throw new NotFoundException('Chat not found');
  }

  async messages(id: string): Promise<ChatMessage[]> {
    await this.assertExists(id);
    const messages: ChatMessage[] = [];
    // Continue until an empty page, even if the server caps a page below 1,000.
    for (;;) {
      const { data, error } = await this.db.from('messages')
        .select('id, thread_id, role, content, created_at').eq('thread_id', id)
        .order('created_at', { ascending: true }).order('id', { ascending: true })
        .range(messages.length, messages.length + 999);
      if (error || !data) databaseError(this.logger, 'Read messages', error);
      if (data.length === 0) return messages;
      messages.push(...data as ChatMessage[]);
    }
  }
}
