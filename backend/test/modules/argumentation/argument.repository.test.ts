import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { buildPrismaMock, resetPrismaMock, type MockPrisma } from "../../setup/mocks/prisma.js";

const prismaMock = buildPrismaMock();

jest.unstable_mockModule("@db/prisma.js", () => ({
  prisma: prismaMock,
}));

type ArgumentRepository =
  typeof import("../../../src/modules/argumentation/argument.repository.js");

let argumentRepository: ArgumentRepository;

function wireTransactionToSameClient(): void {
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    if (typeof arg === "function") {
      return (arg as (tx: MockPrisma) => unknown)(prismaMock);
    }
    return undefined;
  });
}

beforeEach(async () => {
  resetPrismaMock(prismaMock);
  wireTransactionToSameClient();
  jest.resetModules();
  jest.unstable_mockModule("@db/prisma.js", () => ({
    prisma: prismaMock,
  }));
  argumentRepository = await import("../../../src/modules/argumentation/argument.repository.js");
});

describe("argument.repository", () => {
  describe("createInitialArgument", () => {
    it("creates a root argument with variables inside a transaction", async () => {
      const created = {
        id: "arg-root-1",
        schemeId: "s1",
        variables: [{ variableId: "v1", value: "x" }],
      };
      prismaMock.argument.create.mockResolvedValue(created);

      const data = {
        subtopicId: 3,
        schemeId: "s1",
        argumentText: "Hello",
        variables: [{ variableId: "v1", value: "x" }],
      };

      const result = await argumentRepository.createInitialArgument(data, 99);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.argument.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          schemeId: "s1",
          argumentText: "Hello",
          isInitial: true,
          parentId: null,
          parentType: "SUBTOPIC",
          subtopicId: 3,
          status: "UNDECIDED",
          childIds: [],
          descendantCount: 0,
          authorId: 99,
          variables: {
            create: [{ variableId: "v1", value: "x" }],
          },
        },
        include: { variables: true },
      });
      expect(result).toBe(created);
    });
  });

  describe("createCounterArgument", () => {
    it("throws when the parent argument is missing", async () => {
      prismaMock.argument.findUnique.mockResolvedValue(null);

      await expect(
        argumentRepository.createCounterArgument(
          {
            parentArgumentId: "missing",
            schemeId: "s1",
            selectedCqId: "cq1",
            argumentText: "Counter",
            variables: [],
          },
          1,
        ),
      ).rejects.toThrow("Parent argument missing not found");

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("creates counter, updates parent childIds, and walks ancestors for descendant counts", async () => {
      prismaMock.argument.findUnique
        .mockResolvedValueOnce({
          id: "parent",
          subtopicId: 7,
          schemeId: "s0",
          childIds: [],
          descendantCount: 0,
          parentId: "grand",
          isInitial: false,
        })
        .mockResolvedValueOnce({ parentId: "grand" })
        .mockResolvedValueOnce({ parentId: null });

      const created = {
        id: "child-new",
        parentId: "parent",
        variables: [],
      };
      prismaMock.argument.create.mockResolvedValue(created);
      prismaMock.argument.update.mockResolvedValue({});

      const data = {
        parentArgumentId: "parent",
        schemeId: "s1",
        selectedCqId: "cq1",
        argumentText: "Nay",
        variables: [{ variableId: "v2", value: "y" }],
      };

      const result = await argumentRepository.createCounterArgument(data, 42);

      expect(prismaMock.argument.findUnique).toHaveBeenCalledWith({
        where: { id: "parent" },
        select: {
          id: true,
          subtopicId: true,
          schemeId: true,
          childIds: true,
          descendantCount: true,
          parentId: true,
          isInitial: true,
        },
      });
      expect(prismaMock.argument.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          schemeId: "s1",
          selectedCqId: "cq1",
          argumentText: "Nay",
          isInitial: false,
          parentId: "parent",
          parentType: "ARGUMENT",
          subtopicId: 7,
          status: "UNDECIDED",
          childIds: [],
          descendantCount: 0,
          authorId: 42,
          variables: {
            create: [{ variableId: "v2", value: "y" }],
          },
        },
        include: { variables: true },
      });
      expect(prismaMock.argument.update).toHaveBeenCalledWith({
        where: { id: "parent" },
        data: { childIds: { push: expect.any(String) } },
      });
      expect(result).toBe(created);

      const findCalls = prismaMock.argument.findUnique.mock.calls.filter(
        (c) => (c[0] as { select?: { parentId?: boolean } }).select?.parentId,
      );
      expect(findCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("stops incrementing descendants when an ancestor row is missing", async () => {
      prismaMock.argument.findUnique
        .mockResolvedValueOnce({
          id: "p",
          subtopicId: 1,
          schemeId: "s",
          childIds: [],
          descendantCount: 0,
          parentId: "ghost",
          isInitial: true,
        })
        .mockResolvedValueOnce(null);

      prismaMock.argument.create.mockResolvedValue({ id: "c" });
      prismaMock.argument.update.mockResolvedValue({});

      await argumentRepository.createCounterArgument(
        {
          parentArgumentId: "p",
          schemeId: "s",
          selectedCqId: "cq",
          argumentText: "t",
          variables: [],
        },
        1,
      );

      expect(prismaMock.argument.update).toHaveBeenCalled();
    });
  });

  describe("getArgumentById", () => {
    it("returns the argument with variables", async () => {
      const row = { id: "a1", variables: [] };
      prismaMock.argument.findUnique.mockResolvedValue(row);

      const result = await argumentRepository.getArgumentById("a1");

      expect(prismaMock.argument.findUnique).toHaveBeenCalledWith({
        where: { id: "a1" },
        include: { variables: true },
      });
      expect(result).toBe(row);
    });
  });

  describe("getArgumentsBySubtopic", () => {
    it("lists arguments for a subtopic ordered by createdAt", async () => {
      const rows = [{ id: "x" }];
      prismaMock.argument.findMany.mockResolvedValue(rows);

      const result = await argumentRepository.getArgumentsBySubtopic(5);

      expect(prismaMock.argument.findMany).toHaveBeenCalledWith({
        where: { subtopicId: 5 },
        include: { variables: true },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toBe(rows);
    });
  });

  describe("incrementViewCount", () => {
    it("increments viewCount for the argument", async () => {
      prismaMock.argument.update.mockResolvedValue({});

      await argumentRepository.incrementViewCount("id-1");

      expect(prismaMock.argument.update).toHaveBeenCalledWith({
        where: { id: "id-1" },
        data: { viewCount: { increment: 1 } },
      });
    });
  });

  describe("getChildStatuses", () => {
    it("returns an empty array when childIds is empty without querying", async () => {
      const result = await argumentRepository.getChildStatuses([]);

      expect(result).toEqual([]);
      expect(prismaMock.argument.findMany).not.toHaveBeenCalled();
    });

    it("fetches id and status for the given ids", async () => {
      const rows = [
        { id: "c1", status: "ACCEPTED" },
        { id: "c2", status: "REJECTED" },
      ];
      prismaMock.argument.findMany.mockResolvedValue(rows);

      const result = await argumentRepository.getChildStatuses(["c1", "c2"]);

      expect(prismaMock.argument.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["c1", "c2"] } },
        select: { id: true, status: true },
      });
      expect(result).toBe(rows);
    });
  });

  describe("getArgumentWithSubtopicAndTopic", () => {
    it("loads argument with nested subtopic and topic", async () => {
      const row = { id: "a", subtopic: { topic: { id: 1 } } };
      prismaMock.argument.findUnique.mockResolvedValue(row);

      const result = await argumentRepository.getArgumentWithSubtopicAndTopic("a");

      expect(prismaMock.argument.findUnique).toHaveBeenCalledWith({
        where: { id: "a" },
        include: {
          variables: true,
          subtopic: { include: { topic: true } },
        },
      });
      expect(result).toBe(row);
    });
  });

  describe("getAncestorNode", () => {
    it("selects minimal fields for traversal", async () => {
      const node = {
        id: "n",
        schemeId: "s",
        argumentText: "t",
        isInitial: true,
        status: "UNDECIDED",
        parentId: null,
      };
      prismaMock.argument.findUnique.mockResolvedValue(node);

      const result = await argumentRepository.getAncestorNode("n");

      expect(prismaMock.argument.findUnique).toHaveBeenCalledWith({
        where: { id: "n" },
        select: {
          id: true,
          schemeId: true,
          argumentText: true,
          isInitial: true,
          status: true,
          parentId: true,
        },
      });
      expect(result).toBe(node);
    });
  });

  describe("getChildrenByParent", () => {
    it("paginates with cursor and skip when cursor is provided", async () => {
      const rows = [{ id: "ch1" }];
      prismaMock.argument.findMany.mockResolvedValue(rows);

      const result = await argumentRepository.getChildrenByParent("p1", {
        orderBy: { createdAt: "desc" },
        take: 10,
        cursor: "last-id",
      });

      expect(prismaMock.argument.findMany).toHaveBeenCalledWith({
        where: { parentId: "p1" },
        include: { variables: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        cursor: { id: "last-id" },
        skip: 1,
      });
      expect(result).toBe(rows);
    });

    it("omits cursor options when cursor is absent", async () => {
      prismaMock.argument.findMany.mockResolvedValue([]);

      await argumentRepository.getChildrenByParent("p2", {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 5,
      });

      expect(prismaMock.argument.findMany).toHaveBeenCalledWith({
        where: { parentId: "p2" },
        include: { variables: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 5,
      });
    });
  });

  describe("getAllChildrenByParent", () => {
    it("returns all children with variables", async () => {
      const kids = [{ id: "k" }];
      prismaMock.argument.findMany.mockResolvedValue(kids);

      const result = await argumentRepository.getAllChildrenByParent("par");

      expect(prismaMock.argument.findMany).toHaveBeenCalledWith({
        where: { parentId: "par" },
        include: { variables: true },
      });
      expect(result).toBe(kids);
    });
  });

  describe("argumentExists", () => {
    it("returns true when a row exists", async () => {
      prismaMock.argument.findUnique.mockResolvedValue({ id: "exists" });

      await expect(argumentRepository.argumentExists("exists")).resolves.toBe(true);
      expect(prismaMock.argument.findUnique).toHaveBeenCalledWith({
        where: { id: "exists" },
        select: { id: true },
      });
    });

    it("returns false when the argument is missing", async () => {
      prismaMock.argument.findUnique.mockResolvedValue(null);

      await expect(argumentRepository.argumentExists("nope")).resolves.toBe(false);
    });
  });
});
