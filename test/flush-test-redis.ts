import Redis from 'ioredis';

/**
 * Clears BullMQ job state left over from previous e2e runs.
 * Safe only against the local/test Redis configured in setup-e2e.
 */
export async function flushTestRedis(): Promise<void> {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });

  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}
