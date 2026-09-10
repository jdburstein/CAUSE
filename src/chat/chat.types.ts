export interface ChatMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at: string;
}

export interface CreatedChat {
  thread_id: string;
}

export type ChatEvent =
  | { type: 'ready'; data: CreatedChat }
  | { type: 'message.created'; id: string; data: ChatMessage }
  | { type: 'heartbeat'; data: Record<string, never> }
  | { type: 'stream.error'; data: { code: string } };
