import { jest } from "@jest/globals";

type Fn = jest.Mock;

type ModelMock = Record<string, Fn>;

function makeModel(): ModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

export type MockPrisma = {
  user: ModelMock;
  topic: ModelMock;
  subtopic: ModelMock;
  argument: ModelMock;
  scheme: ModelMock;
  activeScheme: ModelMock;
  criticalQuestion: ModelMock;
  argumentVariable: ModelMock;
  $transaction: Fn;
  $connect: Fn;
  $disconnect: Fn;
  $queryRaw: Fn;
  $executeRaw: Fn;
};

export function buildPrismaMock(): MockPrisma {
  return {
    user: makeModel(),
    topic: makeModel(),
    subtopic: makeModel(),
    argument: makeModel(),
    scheme: makeModel(),
    activeScheme: makeModel(),
    criticalQuestion: makeModel(),
    argumentVariable: makeModel(),
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => unknown)(buildPrismaMock());
      }
      return undefined;
    }) as Fn,
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
}

export function resetPrismaMock(mock: MockPrisma): void {
  for (const key of Object.keys(mock)) {
    const entry = (mock as unknown as Record<string, unknown>)[key];
    if (typeof entry === "function" && "mockReset" in entry) {
      (entry as Fn).mockReset();
    } else if (entry && typeof entry === "object") {
      for (const method of Object.values(entry as Record<string, unknown>)) {
        if (typeof method === "function" && "mockReset" in method) {
          (method as Fn).mockReset();
        }
      }
    }
  }
}
