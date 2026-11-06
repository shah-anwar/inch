import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import { buildBullMqModuleMock } from "../setup/mocks/bullmq.js";
import { buildPrismaMock, resetPrismaMock, type MockPrisma } from "../setup/mocks/prisma.js";
import { buildRedisMock } from "../setup/mocks/redis.js";

const bullmq = buildBullMqModuleMock();
jest.unstable_mockModule("bullmq", () => bullmq);

const prismaMock = buildPrismaMock();
jest.unstable_mockModule("../../src/db/prisma.js", () => ({
  prisma: prismaMock,
}));

const evaluateBranch = jest.fn();
jest.unstable_mockModule("../../src/modules/argumentation/evaluation.js", () => ({
  evaluateBranch,
}));

const getRedisClient = jest.fn();
jest.unstable_mockModule("../../src/cache/redis.js", () => ({
  getRedisClient,
}));

const getSubtopicRoom = jest.fn((id: number) => `subtopic-room:${id}`);
const emitToRoom = jest.fn();
jest.unstable_mockModule("../../src/websocket/ws.js", () => ({
  getSubtopicRoom,
  emitToRoom,
}));

type WorkerMod = typeof import("../../src/queue/evaluationWorker.js");
let startEvaluationWorker: WorkerMod["startEvaluationWorker"];

type Job = {
  id: string;
  data: { subtopicId: number; newArgumentId: string };
};

function getProcessor(): (job: Job) => Promise<void> {
  const fn = bullmq.lastWorker?.processFn;
  if (typeof fn !== "function") {
    throw new Error("expected Worker processor to be a function");
  }
  return fn as (job: Job) => Promise<void>;
}

function getFailedHandler(): (job: Job | undefined, err: Error) => void {
  const call = bullmq.lastWorker?.on.mock.calls.find((c) => c[0] === "failed");
  if (!call?.[1] || typeof call[1] !== "function") {
    throw new Error("expected failed handler on worker");
  }
  return call[1] as (job: Job | undefined, err: Error) => void;
}

beforeAll(async () => {
  const mod = await import("../../src/queue/evaluationWorker.js");
  startEvaluationWorker = mod.startEvaluationWorker;
});

describe("evaluationWorker", () => {
  const savedRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    process.env.REDIS_URL = "redis://worker-host:6390";
    resetPrismaMock(prismaMock);
    prismaMock.argument.findMany.mockResolvedValue([]);
    evaluateBranch.mockReset();
    getRedisClient.mockReset();
    getSubtopicRoom.mockClear();
    getSubtopicRoom.mockImplementation((id: number) => `subtopic-room:${id}`);
    emitToRoom.mockClear();
    bullmq.Worker.mockClear();
    prismaMock.argument.findUnique.mockReset();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === "function") {
        return (arg as (tx: MockPrisma) => unknown)(prismaMock);
      }
      return undefined;
    });
  });

  afterEach(() => {
    process.env.REDIS_URL = savedRedisUrl;
  });

  it("throws when REDIS_URL is missing", () => {
    delete process.env.REDIS_URL;
    expect(() => startEvaluationWorker()).toThrow(/REDIS_URL is not set/);
    expect(bullmq.Worker).not.toHaveBeenCalled();
  });

  it("constructs Worker with queue name, Redis connection, concurrency, and registers failed handler", () => {
    startEvaluationWorker();
    expect(bullmq.Worker).toHaveBeenCalledTimes(1);
    expect(bullmq.Worker).toHaveBeenCalledWith(
      "argument-evaluation",
      expect.any(Function),
      expect.objectContaining({
        connection: {
          host: "worker-host",
          port: 6390,
          maxRetriesPerRequest: null,
        },
        concurrency: 1,
      }),
    );
    expect(bullmq.lastWorker?.on).toHaveBeenCalledWith("failed", expect.any(Function));
  });

  it("defaults Redis port to 6379 when URL has no port", () => {
    process.env.REDIS_URL = "redis://only-host";
    startEvaluationWorker();
    expect(bullmq.Worker).toHaveBeenCalledWith(
      "argument-evaluation",
      expect.any(Function),
      expect.objectContaining({
        connection: expect.objectContaining({
          host: "only-host",
          port: 6379,
        }),
      }),
    );
  });

  it("warns and returns when the argument branch is empty", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    startEvaluationWorker();
    prismaMock.argument.findUnique.mockResolvedValue(null);

    await getProcessor()({
      id: "j1",
      data: { subtopicId: 3, newArgumentId: "missing" },
    });

    expect(warn).toHaveBeenCalledWith("[evaluation] Branch empty for arg missing");
    expect(evaluateBranch).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("logs and returns when evaluateBranch yields no changes", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    startEvaluationWorker();
    prismaMock.argument.findUnique.mockResolvedValue({
      id: "root",
      status: "PENDING",
      parentId: null,
      childIds: [],
      isInitial: true,
    });
    evaluateBranch.mockReturnValue(new Map());

    await getProcessor()({
      id: "j2",
      data: { subtopicId: 1, newArgumentId: "root" },
    });

    expect(evaluateBranch).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[evaluation] No status changes for arg root");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("applies status updates, clears caches, emits STATUS_UPDATE, and logs when Redis is available", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const redis = buildRedisMock();
    getRedisClient.mockReturnValue(redis);
    startEvaluationWorker();

    prismaMock.argument.findUnique
      .mockResolvedValueOnce({
        id: "leaf",
        status: "PENDING",
        parentId: "root",
        childIds: [],
        isInitial: false,
      })
      .mockResolvedValueOnce({
        id: "root",
        status: "PENDING",
        parentId: null,
        childIds: ["leaf"],
        isInitial: true,
      });

    const changes = new Map<string, string>([
      ["leaf", "ACCEPTED"],
      ["root", "REJECTED"],
    ]);
    evaluateBranch.mockReturnValue(changes);

    await getProcessor()({
      id: "j3",
      data: { subtopicId: 42, newArgumentId: "leaf" },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith("subtopic:42:arguments");
    expect(redis.del).toHaveBeenCalledWith("argument:leaf");
    expect(redis.del).toHaveBeenCalledWith("argument:root");
    expect(getSubtopicRoom).toHaveBeenCalledWith(42);
    expect(emitToRoom).toHaveBeenCalledWith("subtopic-room:42", "STATUS_UPDATE", {
      subtopicId: 42,
      updates: [
        { id: "leaf", status: "ACCEPTED" },
        { id: "root", status: "REJECTED" },
      ],
    });
    expect(log).toHaveBeenCalledWith("[evaluation] Updated 2 argument(s) in subtopic 42");
    log.mockRestore();
  });

  it("skips Redis deletes when getRedisClient returns null but still emits", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    getRedisClient.mockReturnValue(null);
    startEvaluationWorker();

    prismaMock.argument.findUnique.mockResolvedValue({
      id: "solo",
      status: "PENDING",
      parentId: null,
      childIds: [],
      isInitial: true,
    });
    evaluateBranch.mockReturnValue(new Map([["solo", "ACCEPTED"]]));

    await getProcessor()({
      id: "j4",
      data: { subtopicId: 7, newArgumentId: "solo" },
    });

    expect(getRedisClient).toHaveBeenCalled();
    expect(emitToRoom).toHaveBeenCalled();
    log.mockRestore();
  });

  it("swallows errors from subtopic Redis del and per-argument del", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const redis = buildRedisMock();
    redis.del.mockImplementation(async (key: string) => {
      if (key === "subtopic:5:arguments") {
        throw new Error("subtopic del fail");
      }
      if (key === "argument:a1") {
        throw new Error("arg del fail");
      }
      return 1;
    });
    getRedisClient.mockReturnValue(redis);
    startEvaluationWorker();

    prismaMock.argument.findUnique.mockResolvedValue({
      id: "a1",
      status: "PENDING",
      parentId: null,
      childIds: [],
      isInitial: true,
    });
    evaluateBranch.mockReturnValue(new Map([["a1", "ACCEPTED"]]));

    await expect(
      getProcessor()({
        id: "j5",
        data: { subtopicId: 5, newArgumentId: "a1" },
      }),
    ).resolves.toBeUndefined();
    log.mockRestore();
  });

  it("loads direct attackers off the ancestor path so evaluateBranch sees every sibling status", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    getRedisClient.mockReturnValue(null);
    startEvaluationWorker();

    prismaMock.argument.findUnique
      .mockResolvedValueOnce({
        id: "leaf",
        status: "IN",
        parentId: "root",
        childIds: [],
        isInitial: false,
      })
      .mockResolvedValueOnce({
        id: "root",
        status: "OUT",
        parentId: null,
        childIds: ["leaf", "side"],
        isInitial: true,
      });

    prismaMock.argument.findMany.mockResolvedValue([
      {
        id: "side",
        status: "UNDECIDED",
        parentId: "root",
        childIds: [],
      },
    ]);

    evaluateBranch.mockReturnValue(new Map([["root", "UNDECIDED"]]));

    await getProcessor()({
      id: "j-siblings",
      data: { subtopicId: 9, newArgumentId: "leaf" },
    });

    expect(prismaMock.argument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["side"] } },
      }),
    );
    const passedGraph = evaluateBranch.mock.calls[0]![0] as Map<string, { status: string }>;
    expect(passedGraph.get("side")?.status).toBe("UNDECIDED");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("stops loadBranch when a parent argument row is missing mid-chain", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    startEvaluationWorker();
    prismaMock.argument.findUnique
      .mockResolvedValueOnce({
        id: "orphan",
        status: "PENDING",
        parentId: "ghost",
        childIds: [],
        isInitial: false,
      })
      .mockResolvedValueOnce(null);
    evaluateBranch.mockReturnValue(new Map([["orphan", "ACCEPTED"]]));

    await getProcessor()({
      id: "j6",
      data: { subtopicId: 2, newArgumentId: "orphan" },
    });

    expect(evaluateBranch).toHaveBeenCalledWith(expect.any(Map), "orphan");
    expect(prismaMock.$transaction).toHaveBeenCalled();
    log.mockRestore();
  });

  it("propagates when evaluateBranch throws", async () => {
    startEvaluationWorker();
    prismaMock.argument.findUnique.mockResolvedValue({
      id: "solo",
      status: "PENDING",
      parentId: null,
      childIds: [],
      isInitial: true,
    });
    evaluateBranch.mockImplementation(() => {
      throw new Error("eval-boom");
    });

    await expect(
      getProcessor()({
        id: "j7",
        data: { subtopicId: 1, newArgumentId: "solo" },
      }),
    ).rejects.toThrow("eval-boom");
  });

  it("propagates when prisma.$transaction rejects", async () => {
    startEvaluationWorker();
    prismaMock.argument.findUnique.mockResolvedValue({
      id: "solo",
      status: "PENDING",
      parentId: null,
      childIds: [],
      isInitial: true,
    });
    evaluateBranch.mockReturnValue(new Map([["solo", "ACCEPTED"]]));
    prismaMock.$transaction.mockRejectedValueOnce(new Error("tx-boom"));

    await expect(
      getProcessor()({
        id: "j8",
        data: { subtopicId: 1, newArgumentId: "solo" },
      }),
    ).rejects.toThrow("tx-boom");
  });

  it("logs job failures from the failed event handler", () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    startEvaluationWorker();
    getFailedHandler()({ id: "99" }, new Error("worker-fail"));
    expect(errSpy).toHaveBeenCalledWith("[evaluation] Job 99 failed:", expect.any(Error));
    errSpy.mockRestore();
  });

  it("failed handler tolerates undefined job", () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    startEvaluationWorker();
    getFailedHandler()(undefined, new Error("no job"));
    expect(errSpy).toHaveBeenCalledWith("[evaluation] Job undefined failed:", expect.any(Error));
    errSpy.mockRestore();
  });
});
