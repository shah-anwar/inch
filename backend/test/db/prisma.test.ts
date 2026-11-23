import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const PrismaPg = jest.fn(function PrismaPgMock(this: object) {
  return this;
});

const PrismaClient = jest.fn(function PrismaClientMock(this: object) {
  return this;
});

jest.unstable_mockModule("dotenv/config", () => ({}));
jest.unstable_mockModule("@prisma/adapter-pg", () => ({
  PrismaPg,
}));
jest.unstable_mockModule("../../src/generated/prisma/client.js", () => ({
  PrismaClient,
}));

type PrismaModule = typeof import("../../src/db/prisma.js");

function registerMocks() {
  jest.unstable_mockModule("dotenv/config", () => ({}));
  jest.unstable_mockModule("@prisma/adapter-pg", () => ({
    PrismaPg,
  }));
  jest.unstable_mockModule("../../src/generated/prisma/client.js", () => ({
    PrismaClient,
  }));
}

describe("src/db/prisma", () => {
  beforeEach(() => {
    PrismaPg.mockClear();
    PrismaClient.mockClear();
  });

  it("exports prisma built from PrismaPg and PrismaClient", async () => {
    jest.resetModules();
    process.env.DATABASE_URL = "postgresql://first:first@localhost:5432/first";
    registerMocks();

    const { prisma } = (await import("../../src/db/prisma.js")) as PrismaModule;

    expect(prisma).toBeDefined();
    expect(prisma).toBe(PrismaClient.mock.instances[0]);
    expect(prisma).toBeInstanceOf(PrismaClient);

    expect(PrismaPg).toHaveBeenCalledTimes(1);
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: expect.any(String),
    });
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: "postgresql://first:first@localhost:5432/first",
    });

    const adapter = PrismaPg.mock.instances[0];
    expect(PrismaClient).toHaveBeenCalledTimes(1);
    expect(PrismaClient).toHaveBeenCalledWith({ adapter });
  });

  it("re-reads DATABASE_URL after resetModules and re-mock", async () => {
    jest.resetModules();
    process.env.DATABASE_URL = "postgresql://second:second@localhost:7777/second_db";
    registerMocks();

    await import("../../src/db/prisma.js");

    expect(PrismaPg).toHaveBeenCalledTimes(1);
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: "postgresql://second:second@localhost:7777/second_db",
    });
  });
});
