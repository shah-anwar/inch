import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  buildFastifyMock,
  buildReplyMock,
  buildRequestMock,
  getRouteHandler,
  type MockFastifyInstance,
} from "../../setup/mocks/fastify.js";

const getAdminUser = jest.fn();

const listAdminSchemes = jest.fn();
const getAdminSchemeById = jest.fn();
const createAdminScheme = jest.fn();
const updateAdminScheme = jest.fn();
const listAdminCriticalQuestionsForScheme = jest.fn();
const createAdminCriticalQuestion = jest.fn();
const updateAdminCriticalQuestion = jest.fn();
const getAdminCriticalQuestionById = jest.fn();
const findInvalidSchemeIds = jest.fn();
const listActiveSchemeIds = jest.fn();
const setActiveSchemeIds = jest.fn();
const promoteUserToAdmin = jest.fn();

jest.unstable_mockModule("../../../src/utils/auth.js", () => ({
  getAdminUser,
}));

jest.unstable_mockModule("../../../src/modules/admin/admin.service.js", () => ({
  listAdminSchemes,
  getAdminSchemeById,
  createAdminScheme,
  updateAdminScheme,
  listAdminCriticalQuestionsForScheme,
  createAdminCriticalQuestion,
  updateAdminCriticalQuestion,
  getAdminCriticalQuestionById,
  findInvalidSchemeIds,
  listActiveSchemeIds,
  setActiveSchemeIds,
  promoteUserToAdmin,
}));

type AdminRoutesModule = typeof import("../../../src/modules/admin/admin.routes.js");

let adminRoutes: AdminRoutesModule["adminRoutes"];

const adminUser = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  isAdmin: true,
};

const adminScheme = {
  id: "test_scheme",
  name: "Test scheme",
  description: "A long enough description for validation.",
  conclusion: "Concl",
  variables: [] as unknown[],
  createdAt: "2024-06-01T12:00:00.000Z",
  criticalQuestions: [] as Array<{
    id: string;
    schemeId: string;
    text: string;
    description: string;
    validResponseSchemeIds: string[];
  }>,
};

const adminCq = {
  id: "cq_one",
  schemeId: "test_scheme",
  text: "Critical question text",
  description: "Long description for critical question.",
  validResponseSchemeIds: ["test_scheme"] as string[],
};

const validCreateSchemeBody = {
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

const validCreateCqBody = {
  id: "new_cq",
  text: "Question body text",
  description: "Long description for new CQ.",
  validResponseSchemeIds: ["test_scheme"],
};

beforeAll(async () => {
  const mod = await import("../../../src/modules/admin/admin.routes.js");
  adminRoutes = mod.adminRoutes;
});

describe("admin.routes", () => {
  let app: MockFastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    getAdminUser.mockResolvedValue(adminUser);
    // clearAllMocks keeps implementations, so reset to "all ids valid" here
    // rather than inherit a previous test's invalid-id response.
    findInvalidSchemeIds.mockResolvedValue([]);
    app = buildFastifyMock();
    await adminRoutes(app as never);
  });

  describe("GET /schemes", () => {
    it("returns early without calling the service when admin check fails", async () => {
      getAdminUser.mockResolvedValueOnce(null);
      const handler = getRouteHandler(app, "GET", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(buildRequestMock() as unknown as FastifyRequest, reply);
      expect(listAdminSchemes).not.toHaveBeenCalled();
    });

    it("returns 200 with schemes for an admin", async () => {
      listAdminSchemes.mockResolvedValue([adminScheme]);
      const handler = getRouteHandler(app, "GET", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(buildRequestMock() as unknown as FastifyRequest, reply);
      expect(listAdminSchemes).toHaveBeenCalled();
      expect(reply.statusCode).toBe(200);
      expect(reply.payload).toEqual([adminScheme]);
    });
  });

  describe("GET /schemes/:schemeId", () => {
    it("does not call the service when unauthenticated", async () => {
      getAdminUser.mockResolvedValueOnce(null);
      const handler = getRouteHandler(app, "GET", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ params: { schemeId: "x" } }) as unknown as FastifyRequest,
        reply,
      );
      expect(getAdminSchemeById).not.toHaveBeenCalled();
    });

    it("returns 404 when the scheme is missing", async () => {
      getAdminSchemeById.mockResolvedValue(null);
      const handler = getRouteHandler(app, "GET", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ params: { schemeId: "missing" } }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(404);
      expect(reply.payload).toEqual({ error: "Scheme not found" });
    });

    it("returns 200 when the scheme exists", async () => {
      getAdminSchemeById.mockResolvedValue(adminScheme);
      const handler = getRouteHandler(app, "GET", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ params: { schemeId: "test_scheme" } }) as unknown as FastifyRequest,
        reply,
      );
      expect(getAdminSchemeById).toHaveBeenCalledWith("test_scheme");
      expect(reply.statusCode).toBe(200);
      expect(reply.payload).toEqual(adminScheme);
    });
  });

  describe("POST /schemes", () => {
    it("returns early when not admin", async () => {
      getAdminUser.mockResolvedValueOnce(null);
      const handler = getRouteHandler(app, "POST", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ body: validCreateSchemeBody }) as unknown as FastifyRequest,
        reply,
      );
      expect(createAdminScheme).not.toHaveBeenCalled();
    });

    it("returns 400 when body fails schema validation", async () => {
      const handler = getRouteHandler(app, "POST", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ body: { id: "BAD_ID" } }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(400);
      expect(createAdminScheme).not.toHaveBeenCalled();
      const payload = reply.payload as { error: unknown };
      expect(Array.isArray(payload.error)).toBe(true);
    });

    it("returns 201 when creation succeeds", async () => {
      createAdminScheme.mockResolvedValue(adminScheme);
      const handler = getRouteHandler(app, "POST", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ body: validCreateSchemeBody }) as unknown as FastifyRequest,
        reply,
      );
      expect(createAdminScheme).toHaveBeenCalledWith(validCreateSchemeBody);
      expect(reply.statusCode).toBe(201);
      expect(reply.payload).toEqual(adminScheme);
    });

    it("returns 409 when the scheme id already exists", async () => {
      createAdminScheme.mockRejectedValue(new Error("SCHEME_ID_EXISTS"));
      const handler = getRouteHandler(app, "POST", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ body: validCreateSchemeBody }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(409);
      expect(reply.payload).toEqual({ error: "Scheme ID already exists" });
    });

    it("returns 500 with the message for other errors", async () => {
      createAdminScheme.mockRejectedValue(new Error("DB exploded"));
      const handler = getRouteHandler(app, "POST", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ body: validCreateSchemeBody }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(500);
      expect(reply.payload).toEqual({ error: "DB exploded" });
    });

    it("returns 500 with Internal error when the rejection is not an Error", async () => {
      createAdminScheme.mockRejectedValue("boom");
      const handler = getRouteHandler(app, "POST", "/schemes");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ body: validCreateSchemeBody }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(500);
      expect(reply.payload).toEqual({ error: "Internal error" });
    });
  });

  describe("PATCH /schemes/:schemeId", () => {
    it("rejects updates that include an id field", async () => {
      const handler = getRouteHandler(app, "PATCH", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "s1" },
          body: { id: "nope", name: "Valid name" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(400);
      expect(reply.payload).toEqual({ error: "Scheme ID cannot be updated" });
      expect(updateAdminScheme).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid patch body", async () => {
      const handler = getRouteHandler(app, "PATCH", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "s1" },
          body: { name: "no" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(400);
      expect(updateAdminScheme).not.toHaveBeenCalled();
    });

    it("returns 404 when the scheme is missing", async () => {
      updateAdminScheme.mockResolvedValue(null);
      const handler = getRouteHandler(app, "PATCH", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "gone" },
          body: { name: "Renamed scheme" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(404);
      expect(reply.payload).toEqual({ error: "Scheme not found" });
    });

    it("returns 200 when the update succeeds", async () => {
      const updated = { ...adminScheme, name: "Renamed scheme" };
      updateAdminScheme.mockResolvedValue(updated);
      const handler = getRouteHandler(app, "PATCH", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: { name: "Renamed scheme" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(updateAdminScheme).toHaveBeenCalledWith("test_scheme", {
        name: "Renamed scheme",
      });
      expect(reply.statusCode).toBe(200);
      expect(reply.payload).toEqual(updated);
    });

    it("skips the service when admin is missing", async () => {
      getAdminUser.mockResolvedValueOnce(null);
      const handler = getRouteHandler(app, "PATCH", "/schemes/:schemeId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "s1" },
          body: { name: "Renamed scheme" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(updateAdminScheme).not.toHaveBeenCalled();
    });
  });

  describe("GET /schemes/:schemeId/critical-questions", () => {
    it("returns early when not admin", async () => {
      getAdminUser.mockResolvedValueOnce(null);
      const handler = getRouteHandler(app, "GET", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ params: { schemeId: "s" } }) as unknown as FastifyRequest,
        reply,
      );
      expect(listAdminCriticalQuestionsForScheme).not.toHaveBeenCalled();
    });

    it("returns 404 when the scheme is missing", async () => {
      listAdminCriticalQuestionsForScheme.mockResolvedValue(null);
      const handler = getRouteHandler(app, "GET", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ params: { schemeId: "gone" } }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(404);
      expect(reply.payload).toEqual({ error: "Scheme not found" });
    });

    it("returns 200 with critical questions", async () => {
      listAdminCriticalQuestionsForScheme.mockResolvedValue([adminCq]);
      const handler = getRouteHandler(app, "GET", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({ params: { schemeId: "test_scheme" } }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(200);
      expect(reply.payload).toEqual([adminCq]);
    });
  });

  describe("POST /schemes/:schemeId/critical-questions", () => {
    it("returns early when not admin", async () => {
      getAdminUser.mockResolvedValueOnce(null);
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: validCreateCqBody,
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(findInvalidSchemeIds).not.toHaveBeenCalled();
      expect(createAdminCriticalQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when validResponseSchemeIds reference unknown schemes", async () => {
      findInvalidSchemeIds.mockResolvedValue(["missing_scheme"]);
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: validCreateCqBody,
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(findInvalidSchemeIds).toHaveBeenCalledWith(validCreateCqBody.validResponseSchemeIds);
      expect(createAdminCriticalQuestion).not.toHaveBeenCalled();
      expect(reply.statusCode).toBe(400);
      expect(reply.payload).toEqual({
        error: "Invalid validResponseSchemeIds: missing_scheme",
      });
    });

    it("returns 400 for invalid body", async () => {
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: { id: "BAD" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(400);
      expect(findInvalidSchemeIds).not.toHaveBeenCalled();
    });

    it("returns 201 when creation succeeds", async () => {
      findInvalidSchemeIds.mockResolvedValue([]);
      createAdminCriticalQuestion.mockResolvedValue(adminCq);
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: validCreateCqBody,
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(createAdminCriticalQuestion).toHaveBeenCalledWith("test_scheme", validCreateCqBody);
      expect(reply.statusCode).toBe(201);
      expect(reply.payload).toEqual(adminCq);
    });

    it("returns 404 when the service reports a missing scheme", async () => {
      findInvalidSchemeIds.mockResolvedValue([]);
      createAdminCriticalQuestion.mockRejectedValue(new Error("SCHEME_NOT_FOUND"));
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: validCreateCqBody,
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(404);
      expect(reply.payload).toEqual({ error: "Scheme not found" });
    });

    it("returns 409 when the CQ id already exists", async () => {
      findInvalidSchemeIds.mockResolvedValue([]);
      createAdminCriticalQuestion.mockRejectedValue(new Error("CQ_ID_EXISTS"));
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: validCreateCqBody,
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(409);
      expect(reply.payload).toEqual({
        error: "Critical question ID already exists",
      });
    });

    it("returns 500 for other errors", async () => {
      findInvalidSchemeIds.mockResolvedValue([]);
      createAdminCriticalQuestion.mockRejectedValue(new Error("Unexpected"));
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: validCreateCqBody,
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(500);
      expect(reply.payload).toEqual({ error: "Unexpected" });
    });

    it("returns 500 with Internal error when the rejection is not an Error", async () => {
      findInvalidSchemeIds.mockResolvedValue([]);
      createAdminCriticalQuestion.mockRejectedValue(null);
      const handler = getRouteHandler(app, "POST", "/schemes/:schemeId/critical-questions");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { schemeId: "test_scheme" },
          body: validCreateCqBody,
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(500);
      expect(reply.payload).toEqual({ error: "Internal error" });
    });
  });

  describe("PATCH /critical-questions/:cqId", () => {
    it("returns early when not admin", async () => {
      getAdminUser.mockResolvedValueOnce(null);
      const handler = getRouteHandler(app, "PATCH", "/critical-questions/:cqId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { cqId: "cq1" },
          body: { validResponseSchemeIds: ["test_scheme"] },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(getAdminCriticalQuestionById).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid body", async () => {
      const handler = getRouteHandler(app, "PATCH", "/critical-questions/:cqId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { cqId: "cq1" },
          body: { text: "no" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(400);
      expect(getAdminCriticalQuestionById).not.toHaveBeenCalled();
    });

    it("returns 400 when patched validResponseSchemeIds are invalid", async () => {
      findInvalidSchemeIds.mockResolvedValue(["bad_ref"]);
      const handler = getRouteHandler(app, "PATCH", "/critical-questions/:cqId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { cqId: "cq1" },
          body: { validResponseSchemeIds: ["bad_ref"] },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(findInvalidSchemeIds).toHaveBeenCalledWith(["bad_ref"]);
      expect(updateAdminCriticalQuestion).not.toHaveBeenCalled();
      expect(reply.statusCode).toBe(400);
    });

    // Only validResponseSchemeIds can be patched; CQ text is fixed once created.
    it("returns 400 when validResponseSchemeIds is omitted", async () => {
      const handler = getRouteHandler(app, "PATCH", "/critical-questions/:cqId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { cqId: "cq_one" },
          body: { text: "Only text updated here" },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(400);
      expect(findInvalidSchemeIds).not.toHaveBeenCalled();
      expect(updateAdminCriticalQuestion).not.toHaveBeenCalled();
    });

    it("returns 404 when the CQ is not found", async () => {
      getAdminCriticalQuestionById.mockResolvedValue(null);
      const handler = getRouteHandler(app, "PATCH", "/critical-questions/:cqId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { cqId: "missing" },
          body: { validResponseSchemeIds: ["test_scheme"] },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(404);
      expect(updateAdminCriticalQuestion).not.toHaveBeenCalled();
    });

    it("returns 404 when update returns null", async () => {
      getAdminCriticalQuestionById.mockResolvedValue(adminCq);
      updateAdminCriticalQuestion.mockResolvedValue(null);
      const handler = getRouteHandler(app, "PATCH", "/critical-questions/:cqId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { cqId: "cq_one" },
          body: { validResponseSchemeIds: ["test_scheme"] },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(404);
    });

    it("returns 200 when the patch succeeds", async () => {
      getAdminCriticalQuestionById.mockResolvedValue(adminCq);
      const patched = { ...adminCq, validResponseSchemeIds: ["test_scheme"] };
      updateAdminCriticalQuestion.mockResolvedValue(patched);
      findInvalidSchemeIds.mockResolvedValue([]);
      const handler = getRouteHandler(app, "PATCH", "/critical-questions/:cqId");
      const reply = buildReplyMock() as unknown as FastifyReply;
      await handler(
        buildRequestMock({
          params: { cqId: "cq_one" },
          body: { validResponseSchemeIds: ["test_scheme"] },
        }) as unknown as FastifyRequest,
        reply,
      );
      expect(reply.statusCode).toBe(200);
      expect(reply.payload).toEqual(patched);
    });
  });
});
