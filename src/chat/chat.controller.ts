import { Body, Controller, Get, HttpCode, HttpStatus, MessageEvent, Param, ParseUUIDPipe, Post, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatEventsService } from './chat-events.service';
import { ChatService } from './chat.service';
import { CreateChatDto } from './create-chat.dto';
import { ChatMessage, CreatedChat } from './chat.types';

@Controller('chats')
export class ChatController {
  constructor(private readonly chats: ChatService, private readonly chatEvents: ChatEventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() input: CreateChatDto): Promise<CreatedChat> {
    return this.chats.create(input);
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string): Promise<ChatMessage[]> {
    return this.chats.messages(id);
  }

  @Sse(':id/events')
  async events(@Param('id', ParseUUIDPipe) id: string): Promise<Observable<MessageEvent>> {
    await this.chats.assertExists(id);
    return this.chatEvents.events(id);
  }
}
