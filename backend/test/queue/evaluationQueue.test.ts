import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { buildBullMqModuleMock } from "../setup/mocks/bullmq.js";

const bullmq = buildBullMqModuleMock();

jest.unstable_mockModule("bullmq", () => bullmq);

const modulePath = "../../src/queue/evaluationQueue.js";

describe("evaluationQueue", () => {
  const savedRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    bullmq.Queue.mockClear();
    if (bullmq.lastQueue) {
      bullmq.lastQueue.add.mockClear();
    }
  });

  afterEach(() => {
    process.env.REDIS_URL = savedRedisUrl;
  });

  it("throws when REDIS_URL is unset before creating the queue", async () => {
    delete process.env.REDIS_URL;
    const { evaluationQueue } = await import(modulePath);
    expect(() =>
      evaluationQueue.add("eval", {
        subtopicId: 1,
        newArgumentId: "a1",
      }),
    ).toThrow(/REDIS_URL is not set/);
    expect(bullmq.Queue).not.toHaveBeenCalled();
  });

  it("throws when REDIS_URL is empty before creating the queue", async () => {
    process.env.REDIS_URL = "";
    const { evaluationQueue } = await import(modulePath);
    expect(() =>
      evaluationQueue.add("eval", {
        subtopicId: 1,
        newArgumentId: "a1",
      }),
    ).toThrow(/REDIS_URL is not set/);
    expect(bullmq.Queue).not.toHaveBeenCalled();
  });

  it("constructs Queue once with name, connection, defaultJobOptions, and forwards add", async () => {
    process.env.REDIS_URL = "redis://eval-host:6380";
    const { evaluationQueue } = await import(modulePath);

    const data = { subtopicId: 9, newArgumentId: "arg-x" };
    const opts = { jobId: "custom" };
    await evaluationQueue.add("recompute", data, opts);

    expect(bullmq.Queue).toHaveBeenCalledTimes(1);
    expect(bullmq.Queue).toHaveBeenCalledWith(
      "argument-evaluation",
      expect.objectContaining({
        connection: {
          host: "eval-host",
          port: 6380,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      }),
    );

    expect(bullmq.lastQueue?.add).toHaveBeenCalledTimes(1);
    expect(bullmq.lastQueue?.add).toHaveBeenCalledWith("recompute", data, opts);

    await evaluationQueue.add("recompute", data);
    expect(bullmq.Queue).toHaveBeenCalledTimes(1);
    expect(bullmq.lastQueue?.add).toHaveBeenCalledTimes(2);
    expect(bullmq.lastQueue?.add).toHaveBeenLastCalledWith("recompute", data, undefined);
  });

  it("defaults Redis port to 6379 when URL omits port", async () => {
    process.env.REDIS_URL = "redis://localhost";
    const { evaluationQueue } = await import(modulePath);
    await evaluationQueue.add("x", { subtopicId: 1, newArgumentId: "a" });
    expect(bullmq.Queue).toHaveBeenCalledWith(
      "argument-evaluation",
      expect.objectContaining({
        connection: expect.objectContaining({
          host: "localhost",
          port: 6379,
        }),
      }),
    );
  });
});
