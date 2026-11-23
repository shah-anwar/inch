import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import { buildPrismaMock, resetPrismaMock } from "../../setup/mocks/prisma.js";

const prismaMock = buildPrismaMock();
const getSchemeById = jest.fn();
const renderArgumentText = jest.fn();

jest.unstable_mockModule("@db/prisma.js", () => ({
  prisma: prismaMock,
}));

jest.unstable_mockModule("@inch/types", () => ({
  getSchemeById,
  renderArgumentText,
}));

type SearchService = typeof import("../../../src/modules/search/search.service.js");

let search: SearchService["search"];

beforeAll(async () => {
  const mod = await import("../../../src/modules/search/search.service.js");
  search = mod.search;
});

describe("search", () => {
  beforeEach(() => {
    resetPrismaMock(prismaMock);
    getSchemeById.mockReset();
    renderArgumentText.mockReset();
    prismaMock.topic.findMany.mockResolvedValue([]);
    prismaMock.subtopic.findMany.mockResolvedValue([]);
    prismaMock.argumentVariable.findMany.mockResolvedValue([]);
  });

  it("returns empty results when query is empty", async () => {
    const out = await search("");
    expect(out).toEqual({ results: [], total: 0 });
    expect(prismaMock.topic.findMany).not.toHaveBeenCalled();
  });

  it("returns empty results for whitespace-only query", async () => {
    const out = await search("   \t\n  ");
    expect(out).toEqual({ results: [], total: 0 });
    expect(prismaMock.topic.findMany).not.toHaveBeenCalled();
  });

  it("queries prisma with trimmed lowercased term and aggregates empty DB rows", async () => {
    const out = await search("  Hello  ");
    expect(prismaMock.topic.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { title: { contains: "hello", mode: "insensitive" } },
          { description: { contains: "hello", mode: "insensitive" } },
        ],
      },
    });
    expect(prismaMock.subtopic.findMany).toHaveBeenCalledWith({
      where: { title: { contains: "hello", mode: "insensitive" } },
      include: { topic: true },
    });
    expect(prismaMock.argumentVariable.findMany).toHaveBeenCalledWith({
      where: { value: { contains: "hello", mode: "insensitive" } },
      include: {
        argument: {
          include: {
            variables: true,
            subtopic: { include: { topic: true } },
          },
        },
      },
    });
    expect(out).toEqual({ results: [], total: 0 });
  });

  it("maps topics, subtopics, and deduplicated arguments into results with scheme rendering", async () => {
    prismaMock.topic.findMany.mockResolvedValue([{ id: "t1", title: "T", description: "D" }]);
    prismaMock.subtopic.findMany.mockResolvedValue([
      {
        id: "s1",
        topicId: "t1",
        title: "Sub",
        topic: { title: "Parent topic" },
      },
    ]);
    const arg = {
      id: "a1",
      schemeId: "sch1",
      subtopicId: "s1",
      status: "IN",
      variables: [
        { variableId: "v1", value: "hit" },
        { variableId: "v2", value: "other" },
      ],
      subtopic: {
        title: "Sub",
        topic: { title: "Parent topic" },
      },
    };
    prismaMock.argumentVariable.findMany.mockResolvedValue([
      { argument: arg },
      { argument: { ...arg, variables: arg.variables } },
    ]);
    getSchemeById.mockReturnValue({
      conclusion: { kind: "template" },
    });
    renderArgumentText.mockReturnValue("rendered conclusion");

    const out = await search("hit");

    expect(getSchemeById).toHaveBeenCalledWith("sch1");
    expect(renderArgumentText).toHaveBeenCalled();
    expect(out.total).toBe(3);
    expect(out.results).toHaveLength(3);
    expect(out.results[0]).toEqual({
      type: "topic",
      id: "t1",
      title: "T",
      description: "D",
    });
    expect(out.results[1]).toEqual({
      type: "subtopic",
      id: "s1",
      topicId: "t1",
      title: "Sub",
      topicTitle: "Parent topic",
    });
    expect(out.results[2]).toMatchObject({
      type: "argument",
      id: "a1",
      schemeId: "sch1",
      subtopicId: "s1",
      subtopicTitle: "Sub",
      topicTitle: "Parent topic",
      renderedText: "rendered conclusion",
      status: "IN",
    });
  });

  it("uses schemeId as renderedText when getSchemeById returns undefined", async () => {
    prismaMock.topic.findMany.mockResolvedValue([]);
    prismaMock.subtopic.findMany.mockResolvedValue([]);
    const arg = {
      id: "a2",
      schemeId: "unknown-scheme",
      subtopicId: "s9",
      status: "OUT",
      variables: [{ variableId: "v1", value: "x" }],
      subtopic: {
        title: "St",
        topic: { title: "Tt" },
      },
    };
    prismaMock.argumentVariable.findMany.mockResolvedValue([{ argument: arg }]);
    getSchemeById.mockReturnValue(undefined);

    const out = await search("x");

    expect(renderArgumentText).not.toHaveBeenCalled();
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({
      type: "argument",
      renderedText: "unknown-scheme",
      status: "OUT",
    });
  });

  it("maps argument status UNDECIDED", async () => {
    const arg = {
      id: "a3",
      schemeId: "s",
      subtopicId: "s1",
      status: "UNDECIDED",
      variables: [],
      subtopic: { title: "S", topic: { title: "T" } },
    };
    prismaMock.argumentVariable.findMany.mockResolvedValue([{ argument: arg }]);
    getSchemeById.mockReturnValue(null);

    const out = await search("z");

    expect(out.results[0]).toMatchObject({ status: "UNDECIDED" });
  });

  it("paginates in memory (page 2, limit 1)", async () => {
    prismaMock.topic.findMany.mockResolvedValue([
      { id: "t1", title: "A", description: "" },
      { id: "t2", title: "B", description: "" },
    ]);

    const page1 = await search("q", 1, 1);
    expect(page1.total).toBe(2);
    expect(page1.results).toEqual([{ type: "topic", id: "t1", title: "A", description: "" }]);

    const page2 = await search("q", 2, 1);
    expect(page2.results).toEqual([{ type: "topic", id: "t2", title: "B", description: "" }]);
  });
});
