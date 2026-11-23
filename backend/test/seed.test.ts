import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { buildPrismaMock } from "./setup/mocks/prisma.js";
import type { MockPrisma } from "./setup/mocks/prisma.js";

// The seed replaces the argument trees of its managed topics on every run, so
// these tests check that flow (find-or-create topic, clear old subtopics, rebuild
// trees, propagate grounded statuses) rather than skip-if-present behaviour.

const MANAGED_TOPIC_TITLES = ["Artificial Intelligence", "Public Policy"];
// Totals across both managed topics in src/seed.ts. Update these when the seed
// content changes.
const SEEDED_SUBTOPIC_COUNT = 6;
const SEEDED_ARGUMENT_COUNT = 75;

const minimalSchemes = {
  schemes: [
    {
      id: "expert_opinion",
      name: "Expert Opinion",
      description: "d",
      conclusion: "c",
      variables: [] as unknown[],
      criticalQuestions: [
        {
          id: "cq_eo_1",
          text: "t1",
          description: "d1",
          validResponseSchemeIds: [] as string[],
        },
        {
          id: "cq_eo_2",
          text: "t2",
          description: "d2",
          validResponseSchemeIds: [] as string[],
        },
      ],
    },
  ],
};

let idSeq = 0;
let subIdSeq = 0;
let topicIdSeq = 0;
const bcryptHash = jest.fn(async () => "hashed-seed-password");

function registerSeedMocks(prisma: MockPrisma): void {
  jest.unstable_mockModule("dotenv/config", () => ({}));
  jest.unstable_mockModule("@inch/types", () => ({ schemes: minimalSchemes }));
  jest.unstable_mockModule("@paralleldrive/cuid2", () => ({
    init: () => () => {
      idSeq += 1;
      return `argid_${idSeq}`;
    },
  }));
  jest.unstable_mockModule("bcrypt", () => ({
    default: { hash: bcryptHash },
  }));
  jest.unstable_mockModule("../src/db/prisma.js", () => ({ prisma }));
}

function wireBaseResolves(prisma: MockPrisma): void {
  prisma.scheme.upsert.mockResolvedValue({});
  prisma.activeScheme.upsert.mockResolvedValue({});
  prisma.criticalQuestion.upsert.mockResolvedValue({});
  prisma.user.upsert.mockImplementation(async (args: { create: { email: string } }) => ({
    id: 42,
    email: args.create.email,
  }));
  prisma.topic.findFirst.mockResolvedValue(null);
  prisma.topic.create.mockImplementation(async (args: { data: { title: string } }) => {
    topicIdSeq += 1;
    return { id: topicIdSeq, ...args.data };
  });
  prisma.topic.update.mockResolvedValue({});
  prisma.subtopic.findMany.mockResolvedValue([]);
  prisma.subtopic.create.mockImplementation(
    async (args: { data: { topicId: number; title: string } }) => {
      subIdSeq += 1;
      return { id: subIdSeq, ...args.data };
    },
  );
  prisma.argument.create.mockResolvedValue({});
  prisma.argument.update.mockResolvedValue({});
  prisma.argument.findMany.mockResolvedValue([]);
  prisma.$disconnect.mockResolvedValue(undefined);
}

// seed.ts runs main() on import and does many sequential awaits, so wait for
// its `finally` (which disconnects) instead of a fixed number of ticks.
async function waitForSeedToFinish(prisma: MockPrisma): Promise<void> {
  for (let i = 0; i < 5000; i += 1) {
    if (prisma.$disconnect.mock.calls.length > 0) return;
    await new Promise<void>((r) => setImmediate(r));
  }
  throw new Error("seed did not finish");
}

describe("seed entrypoint", () => {
  let prisma: MockPrisma;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let logSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.resetModules();
    idSeq = 0;
    subIdSeq = 0;
    topicIdSeq = 0;
    bcryptHash.mockClear();
    prisma = buildPrismaMock();
    wireBaseResolves(prisma);
    registerSeedMocks(prisma);
    exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("upserts schemes, active schemes, critical questions and the three demo users", async () => {
    await import("../src/seed.js");
    await waitForSeedToFinish(prisma);

    expect(prisma.scheme.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.activeScheme.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.criticalQuestion.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(3);
    // One hash, shared by all demo users.
    expect(bcryptHash).toHaveBeenCalledTimes(1);
    const passwords = prisma.user.upsert.mock.calls.map(
      (call) => (call[0] as { create: { password: string } }).create.password,
    );
    expect(new Set(passwords)).toEqual(new Set(["hashed-seed-password"]));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("creates both managed topics and their trees on an empty database", async () => {
    await import("../src/seed.js");
    await waitForSeedToFinish(prisma);

    const createdTitles = prisma.topic.create.mock.calls.map(
      (call) => (call[0] as { data: { title: string } }).data.title,
    );
    expect(createdTitles).toEqual(MANAGED_TOPIC_TITLES);
    expect(prisma.topic.update).not.toHaveBeenCalled();
    expect(prisma.subtopic.deleteMany).not.toHaveBeenCalled();
    expect(prisma.subtopic.create).toHaveBeenCalledTimes(SEEDED_SUBTOPIC_COUNT);
    expect(prisma.argument.create).toHaveBeenCalledTimes(SEEDED_ARGUMENT_COUNT);

    // Every argument starts UNDECIDED; the engine assigns real statuses afterwards.
    for (const call of prisma.argument.create.mock.calls) {
      expect((call[0] as { data: { status: string } }).data.status).toBe("UNDECIDED");
    }
    // One childIds/descendantCount update per argument. findMany returns no rows
    // here, so no status updates follow.
    expect(prisma.argument.update).toHaveBeenCalledTimes(SEEDED_ARGUMENT_COUNT);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("updates existing topics and clears their old subtopics before rebuilding", async () => {
    prisma.topic.findFirst.mockImplementation(async (args: { where: { title: string } }) => ({
      id: args.where.title === MANAGED_TOPIC_TITLES[0] ? 1 : 2,
      title: args.where.title,
    }));
    prisma.subtopic.findMany.mockImplementation(async (args: { where: { topicId: number } }) => [
      { id: 100 + args.where.topicId },
    ]);

    await import("../src/seed.js");
    await waitForSeedToFinish(prisma);

    expect(prisma.topic.create).not.toHaveBeenCalled();
    expect(prisma.topic.update).toHaveBeenCalledTimes(2);
    expect(prisma.argumentVariable.deleteMany).toHaveBeenCalledWith({
      where: { argument: { subtopicId: { in: [101] } } },
    });
    expect(prisma.argument.deleteMany).toHaveBeenCalledWith({
      where: { subtopicId: { in: [102] } },
    });
    expect(prisma.subtopic.deleteMany).toHaveBeenCalledWith({ where: { topicId: 1 } });
    expect(prisma.subtopic.deleteMany).toHaveBeenCalledWith({ where: { topicId: 2 } });
    expect(prisma.subtopic.create).toHaveBeenCalledTimes(SEEDED_SUBTOPIC_COUNT);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("writes grounded statuses computed from each subtopic's stored graph", async () => {
    // A root attacked by one leaf: the leaf is IN, so the root is OUT.
    prisma.argument.findMany.mockResolvedValue([
      { id: "root", status: "UNDECIDED", parentId: null, childIds: ["leaf"] },
      { id: "leaf", status: "UNDECIDED", parentId: "root", childIds: [] },
    ]);

    await import("../src/seed.js");
    await waitForSeedToFinish(prisma);

    expect(prisma.$transaction).toHaveBeenCalledTimes(SEEDED_SUBTOPIC_COUNT);
    expect(prisma.argument.update).toHaveBeenCalledWith({
      where: { id: "leaf" },
      data: { status: "IN" },
    });
    expect(prisma.argument.update).toHaveBeenCalledWith({
      where: { id: "root" },
      data: { status: "OUT" },
    });
  });

  it("exits with code 1 when seeding fails", async () => {
    prisma.user.upsert.mockRejectedValueOnce(new Error("upsert failed"));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await import("../src/seed.js");
    await waitForSeedToFinish(prisma);

    expect(errSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(prisma.topic.create).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
