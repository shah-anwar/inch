import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { buildPrismaMock } from "./setup/mocks/prisma.js";
import type { MockPrisma } from "./setup/mocks/prisma.js";

let idCounter = 0;

const evaluateGroundedSemantics = jest.fn((graph: Map<string, { status: string }>) => {
  let i = 0;
  for (const node of graph.values()) {
    node.status = i % 3 === 0 ? "IN" : i % 3 === 1 ? "OUT" : "UNDECIDED";
    i += 1;
  }
  return new Map();
});

function registerLoadTestMocks(prisma: MockPrisma): void {
  jest.unstable_mockModule("dotenv/config", () => ({}));
  jest.unstable_mockModule("@paralleldrive/cuid2", () => ({
    init: () => () => {
      idCounter += 1;
      return `lt_${idCounter}`;
    },
  }));
  jest.unstable_mockModule("@inch/types", () => ({
    getSchemeById: jest.fn((schemeId: string) => ({
      id: schemeId,
      conclusion:
        schemeId === "sign"
          ? "{sign} for {conclusion_b} via {sign_relationship}"
          : "{expert} in {domain}: {claim}",
    })),
    renderArgumentText: jest.fn(
      (conclusion: string, variables: Array<{ variableId: string; value: string }>) =>
        `${conclusion}::${variables.map((v) => v.value).join("::")}`,
    ),
  }));
  jest.unstable_mockModule("../src/modules/argumentation/evaluation.js", () => ({
    evaluateGroundedSemantics,
  }));
  jest.unstable_mockModule("../src/db/prisma.js", () => ({ prisma }));
}

function wireTransaction(prisma: MockPrisma): void {
  prisma.$transaction.mockImplementation(async (fn: unknown, _opts?: unknown) => {
    if (typeof fn === "function") {
      return (fn as (tx: MockPrisma) => Promise<unknown>)(prisma);
    }
    return undefined;
  });
}

function buildEvalRows(overrides: Partial<{ brokenParent: boolean }> = {}): Array<{
  id: string;
  status: string;
  parentId: string | null;
  childIds: string[];
}> {
  const rows: Array<{
    id: string;
    status: string;
    parentId: string | null;
    childIds: string[];
  }> = [];
  for (let i = 0; i < 100; i += 1) {
    const id = `row_${i}`;
    const parentId =
      i === 0 ? null : overrides.brokenParent && i === 1 ? "missing_parent" : `row_${i - 1}`;
    rows.push({
      id,
      status: "UNDECIDED",
      parentId,
      childIds: i < 99 ? [`row_${i + 1}`] : [],
    });
  }
  return rows;
}

function buildSmallTreeRows(): Array<{
  id: string;
  status: string;
  parentId: string | null;
  childIds: string[];
}> {
  const rows: Array<{
    id: string;
    status: string;
    parentId: string | null;
    childIds: string[];
  }> = [];
  rows.push({
    id: "t0",
    status: "UNDECIDED",
    parentId: null,
    childIds: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"],
  });
  for (let i = 1; i <= 8; i += 1) {
    rows.push({
      id: `t${i}`,
      status: "UNDECIDED",
      parentId: "t0",
      childIds: [],
    });
  }
  return rows;
}

function wireDefaultWipeMocks(prisma: MockPrisma): void {
  prisma.subtopic.findMany.mockResolvedValue([]);
  prisma.argumentVariable.deleteMany.mockResolvedValue({ count: 0 });
  prisma.argument.deleteMany.mockResolvedValue({ count: 0 });
  prisma.subtopic.deleteMany.mockResolvedValue({ count: 0 });
}

function wireEvalFindMany(prisma: MockPrisma): void {
  prisma.argument.findMany.mockImplementation(
    async (args: { where?: { subtopicId?: number }; select?: unknown }) => {
      if (args.select) {
        if (args.where?.subtopicId === 21) {
          return buildSmallTreeRows();
        }
        return buildEvalRows();
      }
      return [];
    },
  );
}

async function flush(): Promise<void> {
  await new Promise<void>((r) => setImmediate(r));
  await new Promise<void>((r) => setImmediate(r));
}

describe("load-test-seed entrypoint", () => {
  let prisma: MockPrisma;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let logSpy: jest.SpiedFunction<typeof console.log>;
  let perfSpy: jest.SpiedFunction<typeof performance.now>;

  beforeEach(() => {
    jest.resetModules();
    idCounter = 0;
    process.env.LOAD_TEST_TREE_MAX_LEVEL = "1";
    evaluateGroundedSemantics.mockClear();
    prisma = buildPrismaMock();
    wireTransaction(prisma);
    wireDefaultWipeMocks(prisma);
    prisma.topic.create.mockResolvedValue({ id: 10, title: "Load Test Topic" });
    let subCreateN = 0;
    prisma.subtopic.create.mockImplementation(
      async (args: { data: { title: string; topicId: number } }) => {
        subCreateN += 1;
        return {
          id: subCreateN === 1 ? 20 : 21,
          topicId: args.data.topicId,
          title: args.data.title,
        };
      },
    );
    prisma.user.upsert.mockResolvedValue({ id: 7, email: "seed@inch.dev" });
    prisma.argument.create.mockResolvedValue({});
    prisma.argument.update.mockResolvedValue({});
    prisma.$disconnect.mockResolvedValue(undefined);
    registerLoadTestMocks(prisma);
    exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    perfSpy = jest.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    delete process.env.LOAD_TEST_TREE_MAX_LEVEL;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    perfSpy.mockRestore();
  });

  it("creates topic when missing, wipes, creates two subtopics, seeds, and evaluates", async () => {
    prisma.topic.findFirst.mockResolvedValue(null);
    wireEvalFindMany(prisma);

    await import("../src/load-test-seed.js");
    await flush();

    expect(prisma.topic.create).toHaveBeenCalled();
    expect(prisma.subtopic.findMany).toHaveBeenCalled();
    expect(prisma.subtopic.create).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(evaluateGroundedSemantics).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith("Load test complete");
    expect(prisma.$disconnect).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("reuses an existing topic without calling topic.create", async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: 55, title: "Load Test Topic" });
    wireEvalFindMany(prisma);

    await import("../src/load-test-seed.js");
    await flush();

    expect(prisma.topic.create).not.toHaveBeenCalled();
    expect(prisma.subtopic.create).toHaveBeenCalledTimes(2);
  });

  it("deletes prior subtopic arguments before re-seeding", async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: 55, title: "Load Test Topic" });
    prisma.subtopic.findMany.mockResolvedValue([{ id: 3 }, { id: 4 }]);
    wireEvalFindMany(prisma);

    await import("../src/load-test-seed.js");
    await flush();

    expect(prisma.argumentVariable.deleteMany).toHaveBeenCalled();
    expect(prisma.argument.deleteMany).toHaveBeenCalled();
    expect(prisma.subtopic.deleteMany).toHaveBeenCalledWith({ where: { topicId: 55 } });
  });

  it("always runs both seed transactions even when many arguments existed before wipe", async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: 1, title: "Load Test Topic" });
    prisma.subtopic.findMany.mockResolvedValueOnce([{ id: 2 }]);
    wireEvalFindMany(prisma);

    await import("../src/load-test-seed.js");
    await flush();

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(logSpy).not.toHaveBeenCalledWith("Load test data already seeded");
  });

  it("logs a warning when evaluation duration exceeds 100ms", async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: 1, title: "Load Test Topic" });
    wireEvalFindMany(prisma);
    let perfCalls = 0;
    perfSpy.mockImplementation(() => {
      perfCalls += 1;
      if (perfCalls === 1) return 0;
      if (perfCalls === 2) return 250;
      if (perfCalls === 3) return 0;
      return 0;
    });

    await import("../src/load-test-seed.js");
    await flush();

    expect(logSpy).toHaveBeenCalledWith("Warning: evaluation took over 100ms");
  });

  it("handles a graph with a missing parent when computing depth", async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: 1, title: "Load Test Topic" });
    prisma.argument.findMany.mockImplementation(
      async (args: { where?: { subtopicId?: number }; select?: unknown }) => {
        if (args.select) {
          if (args.where?.subtopicId === 21) {
            return buildSmallTreeRows();
          }
          return buildEvalRows({ brokenParent: true });
        }
        return [];
      },
    );

    await import("../src/load-test-seed.js");
    await flush();

    expect(logSpy).toHaveBeenCalledWith("Load test complete");
  });

  it("treats nullish subtopic.findMany as empty when wiping", async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: 1, title: "Load Test Topic" });
    prisma.subtopic.findMany.mockResolvedValue(null as unknown as []);
    wireEvalFindMany(prisma);

    await import("../src/load-test-seed.js");
    await flush();

    expect(prisma.argumentVariable.deleteMany).not.toHaveBeenCalled();
    expect(prisma.argument.deleteMany).not.toHaveBeenCalled();
    expect(prisma.subtopic.deleteMany).toHaveBeenCalled();
  });

  it("runs tree seeding with depth 2 so even-level expert_opinion counters are created", async () => {
    process.env.LOAD_TEST_TREE_MAX_LEVEL = "2";
    jest.resetModules();
    idCounter = 0;
    prisma = buildPrismaMock();
    wireTransaction(prisma);
    wireDefaultWipeMocks(prisma);
    prisma.topic.findFirst.mockResolvedValue({ id: 1, title: "Load Test Topic" });
    let subCreateN = 0;
    prisma.subtopic.create.mockImplementation(
      async (args: { data: { title: string; topicId: number } }) => {
        subCreateN += 1;
        return {
          id: subCreateN === 1 ? 20 : 21,
          topicId: args.data.topicId,
          title: args.data.title,
        };
      },
    );
    prisma.user.upsert.mockResolvedValue({ id: 7, email: "seed@inch.dev" });
    prisma.argument.create.mockResolvedValue({});
    prisma.argument.update.mockResolvedValue({});
    prisma.$disconnect.mockResolvedValue(undefined);
    registerLoadTestMocks(prisma);
    wireEvalFindMany(prisma);

    await import("../src/load-test-seed.js");
    await flush();

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.argument.create.mock.calls.length).toBeGreaterThan(100);
  });

  it("exits with code 1 when seeding fails", async () => {
    jest.resetModules();
    idCounter = 0;
    process.env.LOAD_TEST_TREE_MAX_LEVEL = "1";
    prisma = buildPrismaMock();
    wireTransaction(prisma);
    wireDefaultWipeMocks(prisma);
    prisma.topic.findFirst.mockResolvedValue(null);
    prisma.topic.create.mockResolvedValue({ id: 10, title: "Load Test Topic" });
    prisma.subtopic.create.mockResolvedValueOnce({ id: 20, topicId: 10, title: "linear" });
    prisma.subtopic.create.mockResolvedValueOnce({ id: 21, topicId: 10, title: "tree" });
    prisma.user.upsert.mockResolvedValue({ id: 7, email: "seed@inch.dev" });
    prisma.argument.create.mockResolvedValue({});
    prisma.argument.update.mockResolvedValue({});
    prisma.argument.findMany.mockResolvedValue([]);
    prisma.$disconnect.mockResolvedValue(undefined);

    jest.unstable_mockModule("dotenv/config", () => ({}));
    jest.unstable_mockModule("@paralleldrive/cuid2", () => ({
      init: () => () => `lt_${++idCounter}`,
    }));
    jest.unstable_mockModule("@inch/types", () => ({
      getSchemeById: jest.fn(() => undefined),
      renderArgumentText: jest.fn(() => ""),
    }));
    jest.unstable_mockModule("../src/modules/argumentation/evaluation.js", () => ({
      evaluateGroundedSemantics,
    }));
    jest.unstable_mockModule("../src/db/prisma.js", () => ({ prisma }));

    const errSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await import("../src/load-test-seed.js");
    await flush();

    expect(errSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(prisma.$disconnect).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
