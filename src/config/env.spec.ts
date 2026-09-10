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
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      }),
    ).toEqual(
      expect.objectContaining<EnvironmentVariables>({
        NODE_ENV: Environment.Test,
        PORT: 4000,
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      }),
    );
  });

  it('rejects an invalid environment', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'staging',
        PORT: 'invalid',
        SUPABASE_URL: 'not-a-url',
        SUPABASE_SERVICE_ROLE_KEY: '',
      }),
    ).toThrow();
  });

  it('requires a backend credential even when an anonymous key is provided', () => {
    expect(() => validateEnvironment({
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_ANON_KEY: 'anonymous-key',
    })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
