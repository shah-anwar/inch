import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import type { FastifyReply } from "fastify";
import {
  buildFastifyMock,
  buildReplyMock,
  buildRequestMock,
  getRouteHandler,
} from "../../setup/mocks/fastify.js";
import type { MockFastifyInstance } from "../../setup/mocks/fastify.js";

const search = jest.fn();

jest.unstable_mockModule("../../../src/modules/search/search.service.js", () => ({
  search,
}));

type SearchRoutes = typeof import("../../../src/modules/search/search.routes.js");

let searchRoutes: SearchRoutes["searchRoutes"];

beforeAll(async () => {
  const mod = await import("../../../src/modules/search/search.routes.js");
  searchRoutes = mod.searchRoutes;
});

describe("searchRoutes", () => {
  let fastify: MockFastifyInstance;

  beforeEach(() => {
    search.mockReset();
    fastify = buildFastifyMock();
  });

  async function runSearch(query: Record<string, unknown>) {
    await searchRoutes(fastify as never);
    const handler = getRouteHandler(fastify, "GET", "/search");
    const request = buildRequestMock({ query }) as never;
    const reply = buildReplyMock() as unknown as FastifyReply;
    await handler(request, reply);
    return reply;
  }

  it("returns empty payload when q is missing (defaults to empty string)", async () => {
    const reply = await runSearch({});
    expect(search).not.toHaveBeenCalled();
    expect(reply.payload).toEqual({
      query: "",
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
  });

  it("returns empty payload when q is whitespace only", async () => {
    const reply = await runSearch({ q: "  \t " });
    expect(search).not.toHaveBeenCalled();
    expect(reply.payload).toEqual({
      query: "  \t ",
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
  });

  it("calls search with trimmed query and sends paginated response", async () => {
    search.mockResolvedValue({
      results: [{ type: "topic" as const, id: "1", title: "X", description: "" }],
      total: 1,
    });
    const reply = await runSearch({ q: "hello", page: "1", limit: "10" });
    expect(search).toHaveBeenCalledWith("hello", 1, 10);
    expect(reply.payload).toEqual({
      query: "hello",
      results: [{ type: "topic", id: "1", title: "X", description: "" }],
      total: 1,
      page: 1,
      totalPages: 1,
    });
  });

  it("clamps page to at least 1", async () => {
    search.mockResolvedValue({ results: [], total: 0 });
    await runSearch({ q: "a", page: "0" });
    expect(search).toHaveBeenCalledWith("a", 1, 10);
  });

  it("clamps limit to 50 when above", async () => {
    search.mockResolvedValue({ results: [], total: 0 });
    await runSearch({ q: "a", limit: "99" });
    expect(search).toHaveBeenCalledWith("a", 1, 50);
  });

  it("clamps limit to at least 1 when below", async () => {
    search.mockResolvedValue({ results: [], total: 0 });
    await runSearch({ q: "a", limit: "0" });
    expect(search).toHaveBeenCalledWith("a", 1, 1);
  });

  it("computes totalPages from total and limit", async () => {
    search.mockResolvedValue({
      results: Array(3).fill(null),
      total: 7,
    });
    const reply = await runSearch({ q: "x", page: "1", limit: "3" });
    expect((reply.payload as { totalPages: number }).totalPages).toBe(3);
  });

  it("sends 500 with Error message when search throws", async () => {
    search.mockRejectedValue(new Error("db down"));
    const reply = await runSearch({ q: "term" });
    expect(reply.statusCode).toBe(500);
    expect(reply.payload).toEqual({ error: "db down" });
    expect(reply.status).toHaveBeenCalledWith(500);
  });

  it("sends 500 with generic message when search throws non-Error", async () => {
    search.mockRejectedValue("boom");
    const reply = await runSearch({ q: "term" });
    expect(reply.statusCode).toBe(500);
    expect(reply.payload).toEqual({ error: "Internal error" });
  });
});
