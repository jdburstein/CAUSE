import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './create-chat.dto';
import { ChatMessage, CreatedChat } from './chat.types';

@Controller('chats')
export class ChatController {
  constructor(private readonly chats: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() input: CreateChatDto): Promise<CreatedChat> {
    return this.chats.create(input);
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string): Promise<ChatMessage[]> {
    return this.chats.messages(id);
  }
}
