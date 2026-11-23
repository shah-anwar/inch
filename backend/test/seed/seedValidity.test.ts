import { jest, describe, it, expect, beforeAll } from "@jest/globals";
import { schemes } from "@inch/types";
import { allowsResponseScheme } from "../../src/utils/activeSchemes.js";
import { buildPrismaMock } from "../setup/mocks/prisma.js";

// The seed writes arguments straight to the database, bypassing the API checks
// in argument.service.ts. This test runs the real seed against a mocked Prisma
// client and checks every counter-argument it creates against the same rules
// the API enforces, using the real scheme catalogue.

type CreatedArgument = {
  id: string;
  schemeId: string;
  isInitial: boolean;
  parentId: string | null;
  selectedCqId: string | null;
  argumentText: string;
};

const prisma = buildPrismaMock();
const created: CreatedArgument[] = [];
const activeSchemeIds = new Set<string>();

function wirePrisma(): void {
  prisma.scheme.upsert.mockResolvedValue({});
  prisma.activeScheme.upsert.mockImplementation(async (args: { create: { schemeId: string } }) => {
    activeSchemeIds.add(args.create.schemeId);
    return {};
  });
  prisma.criticalQuestion.upsert.mockResolvedValue({});
  prisma.user.upsert.mockImplementation(async (args: { create: { email: string } }) => ({
    id: 1,
    email: args.create.email,
  }));
  let topicId = 0;
  prisma.topic.findFirst.mockResolvedValue(null);
  prisma.topic.create.mockImplementation(async (args: { data: { title: string } }) => ({
    id: ++topicId,
    ...args.data,
  }));
  prisma.subtopic.findMany.mockResolvedValue([]);
  let subtopicId = 0;
  prisma.subtopic.create.mockImplementation(async (args: { data: object }) => ({
    id: ++subtopicId,
    ...args.data,
  }));
  prisma.argument.create.mockImplementation(async (args: { data: CreatedArgument }) => {
    created.push(args.data);
    return {};
  });
  prisma.argument.update.mockResolvedValue({});
  prisma.argument.findMany.mockResolvedValue([]);
  prisma.$disconnect.mockResolvedValue(undefined);
}

beforeAll(async () => {
  wirePrisma();
  jest.unstable_mockModule("dotenv/config", () => ({}));
  jest.unstable_mockModule("bcrypt", () => ({
    default: { hash: jest.fn(async () => "hashed") },
  }));
  jest.unstable_mockModule("../../src/db/prisma.js", () => ({ prisma }));
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  await import("../../src/seed.js");
  for (let i = 0; i < 5000 && prisma.$disconnect.mock.calls.length === 0; i += 1) {
    await new Promise<void>((r) => setImmediate(r));
  }
  logSpy.mockRestore();
});

describe("seed data validity", () => {
  it("creates arguments", () => {
    expect(created.length).toBeGreaterThan(0);
  });

  it("every counter-argument follows the critical-question rules", () => {
    const byId = new Map(created.map((a) => [a.id, a]));
    const schemeById = new Map(schemes.schemes.map((s) => [s.id, s]));
    const violations: string[] = [];

    for (const arg of created) {
      if (arg.isInitial) continue;
      // Identify the argument by its opening words; ids are random per run.
      const label = `"${arg.argumentText.slice(0, 50)}…"`;
      const parent = arg.parentId ? byId.get(arg.parentId) : undefined;
      if (!parent) {
        violations.push(`${label}: parent not found`);
        continue;
      }
      const parentScheme = schemeById.get(parent.schemeId);
      const cq = parentScheme?.criticalQuestions.find((c) => c.id === arg.selectedCqId);
      if (!cq) {
        violations.push(`${label}: ${arg.selectedCqId} is not a CQ of ${parent.schemeId}`);
        continue;
      }
      if (!allowsResponseScheme(cq, arg.schemeId)) {
        violations.push(`${label}: ${arg.schemeId} is not a valid response to ${cq.id}`);
      }
      if (!activeSchemeIds.has(arg.schemeId)) {
        violations.push(`${label}: ${arg.schemeId} is not active`);
      }
    }

    expect(violations).toEqual([]);
  });
});
