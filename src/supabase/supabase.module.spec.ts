import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT, SupabaseModule } from './supabase.module';

describe('SupabaseModule', () => {
  it('provides a configured Supabase client', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [
            () => ({
              SUPABASE_URL: 'http://127.0.0.1:54321',
              SUPABASE_ANON_KEY: 'test-anon-key',
            }),
          ],
        }),
        SupabaseModule,
      ],
    }).compile();

    expect(module.get<SupabaseClient>(SUPABASE_CLIENT)).toBeDefined();
  });
});
