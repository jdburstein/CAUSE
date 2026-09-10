import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [UsersModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
