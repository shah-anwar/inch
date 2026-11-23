import { Redis } from "ioredis";

let _redis: Redis | null = null;

/**
 * Returns a shared Redis client for optional cache-aside reads/writes.
 *
 * @returns Connected Redis client, or `null` when `REDIS_URL` is not configured.
 */
export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    _redis.on("error", (err: Error) => {
      console.error("[redis] connection error:", err.message);
    });
  }
  return _redis;
}

/**
 * Creates a dedicated Redis connection for BullMQ components.
 *
 * @returns New Redis connection configured for worker/queue reliability.
 * @throws {Error} Thrown when `REDIS_URL` is missing.
 */
export function createRedisConnection(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is not set. Redis is required for the evaluation queue. " +
        "Add REDIS_URL=redis://localhost:6379 to backend/.env",
    );
  }
  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}
