import { Queue } from "bullmq";

/** Payload schema for argument re-evaluation queue jobs. */
export interface EvaluationJobData {
  subtopicId: number;
  newArgumentId: string;
}

let _queue: Queue | null = null;

/**
 * Lazily creates and returns the BullMQ queue used for status evaluation jobs.
 *
 * @returns Shared queue instance.
 * @throws {Error} Thrown when Redis connection configuration is unavailable.
 */
function getQueue(): Queue {
  if (!_queue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        "REDIS_URL is not set. Redis is required for the evaluation queue. " +
          "Add REDIS_URL=redis://localhost:6379 to backend/.env",
      );
    }
    const url = new URL(redisUrl);
    _queue = new Queue("argument-evaluation", {
      connection: {
        host: url.hostname,
        port: Number(url.port) || 6379,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return _queue;
}

/**
 * Queue facade used by services to enqueue evaluation jobs.
 */
export const evaluationQueue = {
  add: (name: string, data: EvaluationJobData, opts?: Record<string, unknown>) =>
    getQueue().add(name, data, opts),
};
