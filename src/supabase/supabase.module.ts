import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvironmentVariables } from '../config/env';

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ): SupabaseClient =>
        createClient(
          configService.get('SUPABASE_URL', { infer: true }),
          configService.get('SUPABASE_ANON_KEY', { infer: true }),
        ),
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
