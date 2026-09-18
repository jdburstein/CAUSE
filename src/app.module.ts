import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnvironment } from './config/env';
import { SupabaseModule } from './supabase/supabase.module';
import { AgentModule } from './agent/agent.module';
import { ChatModule } from './chat/chat.module';
import { UsersModule } from './users/users.module';
import { createObserveModule } from '@nestjs/observe';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    SupabaseModule,
    AgentModule,
    ChatModule,
    UsersModule,
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY,
      appSecret: process.env.OBSERVE_APP_SECRET,
      serviceId: 'cause-ai-agent',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
