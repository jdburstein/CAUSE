import {
  Environment,
  EnvironmentVariables,
  validateEnvironment,
} from './env';

describe('validateEnvironment', () => {
  it('transforms and validates environment variables', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        PORT: '4000',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_ANON_KEY: 'test-anon-key',
      }),
    ).toEqual(
      expect.objectContaining<EnvironmentVariables>({
        NODE_ENV: Environment.Test,
        PORT: 4000,
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_ANON_KEY: 'test-anon-key',
      }),
    );
  });

  it('rejects an invalid environment', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'staging',
        PORT: 'invalid',
        SUPABASE_URL: 'not-a-url',
        SUPABASE_ANON_KEY: '',
      }),
    ).toThrow();
  });
});
