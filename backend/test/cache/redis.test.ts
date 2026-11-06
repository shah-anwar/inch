import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

type RedisMockInstance = {
  on: jest.Mock;
};

function buildInstance(): RedisMockInstance {
  const inst: RedisMockInstance = {
    on: jest.fn((_event: string, _handler: (err: Error) => void) => inst),
  };
  return inst;
}

const Redis = jest.fn((_url: string, _opts: unknown): RedisMockInstance => buildInstance());

jest.unstable_mockModule("ioredis", () => ({
  __esModule: true,
  Redis,
}));

const redisModulePath = "../../src/cache/redis.js";

describe("redis cache module", () => {
  const savedRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    Redis.mockClear();
    Redis.mockImplementation((_url: string, _opts: unknown): RedisMockInstance => buildInstance());
  });

  afterEach(() => {
    process.env.REDIS_URL = savedRedisUrl;
  });

  it("getRedisClient returns null when REDIS_URL is unset and does not construct Redis", async () => {
    delete process.env.REDIS_URL;
    const { getRedisClient } = await import(redisModulePath);
    expect(getRedisClient()).toBeNull();
    expect(Redis).not.toHaveBeenCalled();
  });

  it("getRedisClient returns null when REDIS_URL is empty and does not construct Redis", async () => {
    process.env.REDIS_URL = "";
    const { getRedisClient } = await import(redisModulePath);
    expect(getRedisClient()).toBeNull();
    expect(Redis).not.toHaveBeenCalled();
  });

  it("getRedisClient constructs Redis once with expected options and registers error handler", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { getRedisClient } = await import(redisModulePath);
    const client = getRedisClient();

    expect(client).not.toBeNull();
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    const instance = Redis.mock.results[0]?.value as RedisMockInstance;
    expect(instance.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("getRedisClient returns the same instance on subsequent calls without constructing again", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { getRedisClient } = await import(redisModulePath);
    const first = getRedisClient();
    const second = getRedisClient();

    expect(first).toBe(second);
    expect(Redis).toHaveBeenCalledTimes(1);
  });

  it("invokes the registered error handler and logs via console.error", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { getRedisClient } = await import(redisModulePath);
    getRedisClient();

    const instance = Redis.mock.results[0]?.value as RedisMockInstance;
    const errorCall = instance.on.mock.calls.find((c) => c[0] === "error");
    const handler = errorCall?.[1] as ((err: Error) => void) | undefined;
    expect(handler).toBeDefined();
    handler!(new Error("boom"));

    expect(consoleSpy).toHaveBeenCalledWith("[redis] connection error:", "boom");
    consoleSpy.mockRestore();
  });

  it("createRedisConnection throws when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { createRedisConnection } = await import(redisModulePath);
    expect(() => createRedisConnection()).toThrow(/REDIS_URL is not set/);
    expect(Redis).not.toHaveBeenCalled();
  });

  it("createRedisConnection constructs Redis with maxRetriesPerRequest null", async () => {
    process.env.REDIS_URL = "redis://queue:6379";
    const { createRedisConnection } = await import(redisModulePath);
    const conn = createRedisConnection();

    expect(conn).toBeDefined();
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith("redis://queue:6379", {
      maxRetriesPerRequest: null,
    });
  });
});
