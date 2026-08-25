import { buildRedisConnection } from './redis-connection.config';

describe('buildRedisConnection', () => {
  it('parses redis:// URL without TLS', () => {
    expect(
      buildRedisConnection({
        REDIS_URL: 'redis://default:secret@localhost:6380',
      }),
    ).toEqual({
      host: 'localhost',
      port: 6380,
      username: 'default',
      password: 'secret',
    });
  });

  it('parses rediss:// URL with TLS (Upstash-style)', () => {
    expect(
      buildRedisConnection({
        REDIS_URL:
          'rediss://default:p%40ss@assuring-wren-107186.upstash.io:6379',
      }),
    ).toEqual({
      host: 'assuring-wren-107186.upstash.io',
      port: 6379,
      username: 'default',
      password: 'p@ss',
      tls: {},
    });
  });

  it('falls back to discrete host/port/password vars', () => {
    expect(
      buildRedisConnection({
        REDIS_HOST: 'redis.internal',
        REDIS_PORT: '6381',
        REDIS_PASSWORD: 'pw',
      }),
    ).toEqual({
      host: 'redis.internal',
      port: 6381,
      username: undefined,
      password: 'pw',
    });
  });

  it('enables TLS from REDIS_TLS when not using URL', () => {
    expect(
      buildRedisConnection({
        REDIS_HOST: 'upstash.example',
        REDIS_PORT: '6379',
        REDIS_USERNAME: 'default',
        REDIS_PASSWORD: 'pw',
        REDIS_TLS: 'true',
      }),
    ).toEqual({
      host: 'upstash.example',
      port: 6379,
      username: 'default',
      password: 'pw',
      tls: {},
    });
  });
});
