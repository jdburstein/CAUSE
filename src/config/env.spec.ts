import {
  Environment,
  EnvironmentVariables,
  validateEnvironment,
} from './env';

describe('validateEnvironment', () => {
  it('transforms and validates environment variables', () => {
    expect(validateEnvironment({ NODE_ENV: 'test', PORT: '4000' })).toEqual(
      expect.objectContaining<EnvironmentVariables>({
        NODE_ENV: Environment.Test,
        PORT: 4000,
      }),
    );
  });

  it('rejects an invalid environment', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'staging', PORT: 'invalid' }),
    ).toThrow();
  });
});
