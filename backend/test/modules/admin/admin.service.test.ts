import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import { buildPrismaMock } from "../../setup/mocks/prisma.js";

const prismaMock = buildPrismaMock();

jest.unstable_mockModule("@db/prisma.js", () => ({
  prisma: prismaMock,
}));

type AdminService = typeof import("../../../src/modules/admin/admin.service.js");

let listAdminSchemes: AdminService["listAdminSchemes"];
let getAdminSchemeById: AdminService["getAdminSchemeById"];
let createAdminScheme: AdminService["createAdminScheme"];
let updateAdminScheme: AdminService["updateAdminScheme"];
let listAdminCriticalQuestionsForScheme: AdminService["listAdminCriticalQuestionsForScheme"];
let createAdminCriticalQuestion: AdminService["createAdminCriticalQuestion"];
let getAdminCriticalQuestionById: AdminService["getAdminCriticalQuestionById"];
let updateAdminCriticalQuestion: AdminService["updateAdminCriticalQuestion"];
let findInvalidSchemeIds: AdminService["findInvalidSchemeIds"];

const schemeRow = (
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    conclusion: string;
    variables: unknown;
    createdAt: Date;
    criticalQuestions: Array<{
      id: string;
      schemeId: string;
      text: string;
      description: string;
      validResponseSchemeIds: string[];
    }>;
  }> = {},
) => ({
  id: "test_scheme",
  name: "Test scheme",
  description: "A long enough description for validation.",
  conclusion: "Concl",
  variables: [] as unknown,
  createdAt: new Date("2024-06-01T12:00:00.000Z"),
  criticalQuestions: [
    {
      id: "cq_one",
      schemeId: "test_scheme",
      text: "Critical text here",
      description: "Another long description for CQ.",
      validResponseSchemeIds: ["other_scheme"],
    },
  ],
  ...overrides,
});

beforeAll(async () => {
  const mod = await import("../../../src/modules/admin/admin.service.js");
  listAdminSchemes = mod.listAdminSchemes;
  getAdminSchemeById = mod.getAdminSchemeById;
  createAdminScheme = mod.createAdminScheme;
  updateAdminScheme = mod.updateAdminScheme;
  listAdminCriticalQuestionsForScheme = mod.listAdminCriticalQuestionsForScheme;
  createAdminCriticalQuestion = mod.createAdminCriticalQuestion;
  getAdminCriticalQuestionById = mod.getAdminCriticalQuestionById;
  updateAdminCriticalQuestion = mod.updateAdminCriticalQuestion;
  findInvalidSchemeIds = mod.findInvalidSchemeIds;
});

describe("admin.service", () => {
  beforeEach(() => {
    prismaMock.scheme.findMany.mockReset();
    prismaMock.scheme.findUnique.mockReset();
    prismaMock.scheme.create.mockReset();
    prismaMock.scheme.update.mockReset();
    prismaMock.criticalQuestion.findMany.mockReset();
    prismaMock.criticalQuestion.findUnique.mockReset();
    prismaMock.criticalQuestion.create.mockReset();
    prismaMock.criticalQuestion.update.mockReset();
  });

  describe("listAdminSchemes", () => {
    it("maps schemes and critical questions to the admin contract", async () => {
      prismaMock.scheme.findMany.mockResolvedValue([
        schemeRow({ id: "a" }),
        schemeRow({
          id: "b",
          criticalQuestions: [],
        }),
      ]);

      const out = await listAdminSchemes();

      expect(prismaMock.scheme.findMany).toHaveBeenCalledWith({
        include: { criticalQuestions: true },
        orderBy: { id: "asc" },
      });
      expect(out).toHaveLength(2);
      expect(out[0].createdAt).toBe("2024-06-01T12:00:00.000Z");
      expect(out[0].criticalQuestions[0].id).toBe("cq_one");
      expect(out[1].criticalQuestions).toEqual([]);
    });
  });

  describe("getAdminSchemeById", () => {
    it("returns null when the scheme is missing", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue(null);
      await expect(getAdminSchemeById("missing")).resolves.toBeNull();
    });

    it("returns a mapped scheme when found", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue(schemeRow({ id: "x" }));
      const out = await getAdminSchemeById("x");
      expect(out?.id).toBe("x");
      expect(out?.criticalQuestions).toHaveLength(1);
    });
  });

  describe("createAdminScheme", () => {
    const createPayload = {
      id: "new_scheme",
      name: "New scheme",
      description: "Long enough description text.",
      conclusion: "Short",
      variables: [
        {
          id: "v1",
          name: "Var",
          description: "Variable description here.",
          placeholder: "ph",
          type: "string",
          required: true,
        },
      ],
    };

    it("throws when the id already exists", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue({ id: "new_scheme" });
      await expect(createAdminScheme(createPayload)).rejects.toThrow("SCHEME_ID_EXISTS");
      expect(prismaMock.scheme.create).not.toHaveBeenCalled();
    });

    it("creates and returns the new scheme", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue(null);
      prismaMock.scheme.create.mockResolvedValue(
        schemeRow({
          id: "new_scheme",
          name: "New scheme",
          variables: createPayload.variables,
          criticalQuestions: [],
        }),
      );

      const out = await createAdminScheme(createPayload);

      expect(prismaMock.scheme.create).toHaveBeenCalledWith({
        data: {
          id: "new_scheme",
          name: "New scheme",
          description: "Long enough description text.",
          conclusion: "Short",
          variables: createPayload.variables,
        },
        include: { criticalQuestions: true },
      });
      expect(out.id).toBe("new_scheme");
      expect(out.criticalQuestions).toEqual([]);
    });
  });

  describe("updateAdminScheme", () => {
    it("returns null when the scheme does not exist", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue(null);
      await expect(updateAdminScheme("nope", { name: "Renamed scheme" })).resolves.toBeNull();
      expect(prismaMock.scheme.update).not.toHaveBeenCalled();
    });

    it("applies partial updates and returns the mapped scheme", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue({ id: "s1" });
      prismaMock.scheme.update.mockResolvedValue(
        schemeRow({
          id: "s1",
          name: "Patched name",
          description: "Updated description text long.",
          conclusion: "Newcl",
          variables: [{ x: 1 }],
        }),
      );

      const out = await updateAdminScheme("s1", {
        name: "Patched name",
        description: "Updated description text long.",
        conclusion: "Newcl",
        variables: [{ x: 1 }] as never,
      });

      expect(prismaMock.scheme.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: {
          name: "Patched name",
          description: "Updated description text long.",
          conclusion: "Newcl",
          variables: [{ x: 1 }],
        },
        include: { criticalQuestions: true },
      });
      expect(out?.name).toBe("Patched name");
      expect(out?.variables).toEqual([{ x: 1 }]);
    });

    it("passes undefined for omitted optional fields", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue({ id: "s1" });
      prismaMock.scheme.update.mockResolvedValue(schemeRow({ id: "s1" }));

      await updateAdminScheme("s1", {});

      expect(prismaMock.scheme.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: {
          name: undefined,
          description: undefined,
          conclusion: undefined,
          variables: undefined,
        },
        include: { criticalQuestions: true },
      });
    });
  });

  describe("listAdminCriticalQuestionsForScheme", () => {
    it("returns null when the parent scheme is missing", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue(null);
      await expect(listAdminCriticalQuestionsForScheme("gone")).resolves.toBeNull();
      expect(prismaMock.criticalQuestion.findMany).not.toHaveBeenCalled();
    });

    it("returns mapped critical questions ordered by id", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue({ id: "parent" });
      prismaMock.criticalQuestion.findMany.mockResolvedValue([
        {
          id: "z_cq",
          schemeId: "parent",
          text: "Second question text",
          description: "Description for second CQ.",
          validResponseSchemeIds: [],
        },
        {
          id: "a_cq",
          schemeId: "parent",
          text: "First question text here",
          description: "Description for first CQ here.",
          validResponseSchemeIds: ["s1"],
        },
      ]);

      const out = await listAdminCriticalQuestionsForScheme("parent");

      expect(prismaMock.criticalQuestion.findMany).toHaveBeenCalledWith({
        where: { schemeId: "parent" },
        orderBy: { id: "asc" },
      });
      expect(out).toHaveLength(2);
      expect(out?.[0].id).toBe("z_cq");
    });
  });

  describe("createAdminCriticalQuestion", () => {
    const cqPayload = {
      id: "new_cq",
      text: "Question body text",
      description: "Long description for new CQ.",
      validResponseSchemeIds: ["s1", "s2"],
    };

    it("throws SCHEME_NOT_FOUND when the scheme is missing", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue(null);
      await expect(createAdminCriticalQuestion("missing", cqPayload)).rejects.toThrow(
        "SCHEME_NOT_FOUND",
      );
      expect(prismaMock.criticalQuestion.create).not.toHaveBeenCalled();
    });

    it("throws CQ_ID_EXISTS when the id is taken", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue({ id: "parent" });
      prismaMock.criticalQuestion.findUnique.mockResolvedValue({
        id: "new_cq",
      });
      await expect(createAdminCriticalQuestion("parent", cqPayload)).rejects.toThrow(
        "CQ_ID_EXISTS",
      );
    });

    it("creates a critical question under the scheme", async () => {
      prismaMock.scheme.findUnique.mockResolvedValue({ id: "parent" });
      prismaMock.criticalQuestion.findUnique.mockResolvedValue(null);
      prismaMock.criticalQuestion.create.mockResolvedValue({
        id: "new_cq",
        schemeId: "parent",
        text: cqPayload.text,
        description: cqPayload.description,
        validResponseSchemeIds: cqPayload.validResponseSchemeIds,
      });

      const out = await createAdminCriticalQuestion("parent", cqPayload);

      expect(prismaMock.criticalQuestion.create).toHaveBeenCalledWith({
        data: {
          id: "new_cq",
          schemeId: "parent",
          text: cqPayload.text,
          description: cqPayload.description,
          validResponseSchemeIds: cqPayload.validResponseSchemeIds,
        },
      });
      expect(out.schemeId).toBe("parent");
    });
  });

  describe("getAdminCriticalQuestionById", () => {
    it("returns null when missing", async () => {
      prismaMock.criticalQuestion.findUnique.mockResolvedValue(null);
      await expect(getAdminCriticalQuestionById("n")).resolves.toBeNull();
    });

    it("returns mapped CQ when present", async () => {
      prismaMock.criticalQuestion.findUnique.mockResolvedValue({
        id: "cq",
        schemeId: "s",
        text: "Some question text",
        description: "Description long enough.",
        validResponseSchemeIds: ["a"],
      });
      const out = await getAdminCriticalQuestionById("cq");
      expect(out?.id).toBe("cq");
    });
  });

  describe("updateAdminCriticalQuestion", () => {
    it("returns null when the CQ does not exist", async () => {
      prismaMock.criticalQuestion.findUnique.mockResolvedValue(null);
      await expect(
        updateAdminCriticalQuestion("n", { validResponseSchemeIds: ["x"] }),
      ).resolves.toBeNull();
      expect(prismaMock.criticalQuestion.update).not.toHaveBeenCalled();
    });

    // Only validResponseSchemeIds is patchable (UpdateCriticalQuestionSchema is
    // strict); CQ text and description are fixed once created.
    it("updates validResponseSchemeIds and returns the mapped CQ", async () => {
      prismaMock.criticalQuestion.findUnique.mockResolvedValue({ id: "cq1" });
      prismaMock.criticalQuestion.update.mockResolvedValue({
        id: "cq1",
        schemeId: "sch",
        text: "Original text",
        description: "Original description text long.",
        validResponseSchemeIds: ["x"],
      });

      const out = await updateAdminCriticalQuestion("cq1", {
        validResponseSchemeIds: ["x"],
      });

      expect(prismaMock.criticalQuestion.update).toHaveBeenCalledWith({
        where: { id: "cq1" },
        data: {
          validResponseSchemeIds: ["x"],
        },
      });
      expect(out?.validResponseSchemeIds).toEqual(["x"]);
      expect(out?.text).toBe("Original text");
    });

    it("uses undefined for omitted fields in the update payload", async () => {
      prismaMock.criticalQuestion.findUnique.mockResolvedValue({ id: "cq1" });
      prismaMock.criticalQuestion.update.mockResolvedValue({
        id: "cq1",
        schemeId: "sch",
        text: "T",
        description: "D",
        validResponseSchemeIds: [],
      });

      await updateAdminCriticalQuestion("cq1", {});

      expect(prismaMock.criticalQuestion.update).toHaveBeenCalledWith({
        where: { id: "cq1" },
        data: {
          text: undefined,
          description: undefined,
          validResponseSchemeIds: undefined,
        },
      });
    });
  });

  describe("findInvalidSchemeIds", () => {
    it("returns an empty list when ids is empty", async () => {
      await expect(findInvalidSchemeIds([])).resolves.toEqual([]);
      expect(prismaMock.scheme.findMany).not.toHaveBeenCalled();
    });

    it("returns ids that are not present in the database", async () => {
      prismaMock.scheme.findMany.mockResolvedValue([{ id: "a" }, { id: "c" }]);
      const out = await findInvalidSchemeIds(["a", "b", "c", "d"]);
      expect(prismaMock.scheme.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["a", "b", "c", "d"] } },
        select: { id: true },
      });
      expect(out).toEqual(["b", "d"]);
    });

    it("returns an empty array when every id exists", async () => {
      prismaMock.scheme.findMany.mockResolvedValue([{ id: "x" }]);
      const out = await findInvalidSchemeIds(["x"]);
      expect(out).toEqual([]);
    });
  });
});
