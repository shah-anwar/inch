import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import { buildPrismaMock } from "../../setup/mocks/prisma.js";

const prismaMock = buildPrismaMock();

jest.unstable_mockModule("@db/prisma.js", () => ({
  prisma: prismaMock,
}));

type SchemeRepo = typeof import("../../../src/modules/argumentation/scheme.repository.js");

let listSchemesForSuggestion: SchemeRepo["listSchemesForSuggestion"];

describe("scheme.repository", () => {
  beforeAll(async () => {
    const mod = await import("../../../src/modules/argumentation/scheme.repository.js");
    listSchemesForSuggestion = mod.listSchemesForSuggestion;
  });

  beforeEach(() => {
    prismaMock.scheme.findMany.mockReset();
  });

  it("lists schemes with stable ordering and suggestion fields", async () => {
    prismaMock.scheme.findMany.mockResolvedValue([
      {
        id: "b_scheme",
        name: "B",
        description: "Desc B",
        variables: [{ id: "x" }],
      },
      {
        id: "a_scheme",
        name: "A",
        description: "Desc A",
        variables: [],
      },
    ]);

    const rows = await listSchemesForSuggestion();

    expect(prismaMock.scheme.findMany).toHaveBeenCalledWith({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        variables: true,
      },
    });
    expect(rows).toEqual([
      {
        id: "b_scheme",
        name: "B",
        description: "Desc B",
        variables: [{ id: "x" }],
      },
      {
        id: "a_scheme",
        name: "A",
        description: "Desc A",
        variables: [],
      },
    ]);
  });
});
