import type { ConnectionOptions } from 'bullmq';

type RedisEnv = {
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  REDIS_USERNAME?: string;
  REDIS_TLS?: string;
};

/**
 * Builds BullMQ/ioredis connection options from env.
 * Prefers REDIS_URL (supports redis:// and rediss:// TLS).
 */
export function buildRedisConnection(env: RedisEnv): ConnectionOptions {
  const url = env.REDIS_URL?.trim();
  if (url) {
    const parsed = new URL(url);
    const useTls = parsed.protocol === 'rediss:';

    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      ...(useTls ? { tls: {} } : {}),
    };
  }

  const useTls = env.REDIS_TLS === 'true';

  return {
    host: env.REDIS_HOST ?? 'localhost',
    port: parseInt(env.REDIS_PORT ?? '6379', 10),
    username: env.REDIS_USERNAME || undefined,
    password: env.REDIS_PASSWORD || undefined,
    ...(useTls ? { tls: {} } : {}),
  };
}
