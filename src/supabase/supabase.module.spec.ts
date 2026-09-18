import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT, SupabaseModule } from './supabase.module';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

describe('SupabaseModule', () => {
  it('provides a configured Supabase client', async () => {
    const client = { from: jest.fn() };
    (createClient as jest.Mock).mockReturnValue(client);
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              SUPABASE_URL: 'http://127.0.0.1:54321',
              SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
            }),
          ],
        }),
        SupabaseModule,
      ],
    }).compile();

    expect(module.get(SUPABASE_CLIENT)).toBe(client);
    expect(createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'test-service-role-key',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await module.close();
  });
});
