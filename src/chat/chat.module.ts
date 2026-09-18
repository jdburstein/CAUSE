import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatEventsService } from './chat-events.service';

@Module({
  imports: [UsersModule],
  controllers: [ChatController],
  providers: [ChatService, ChatEventsService],
})
export class ChatModule {}
