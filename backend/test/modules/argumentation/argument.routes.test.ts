import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import {
  buildFastifyMock,
  buildReplyMock,
  buildRequestMock,
  getRouteHandler,
  type MockFastifyInstance,
} from "../../setup/mocks/fastify.js";

const getArgumentById = jest.fn();
jest.unstable_mockModule("../../../src/modules/argumentation/argument.repository.js", () => ({
  getArgumentById,
}));

const submitInitialArgument = jest.fn();
const submitCounterArgument = jest.fn();
const previewArgumentText = jest.fn();
const discardArgumentTextPreview = jest.fn();
const getSubtopicGraph = jest.fn();
const getEnrichedArgument = jest.fn();
const getArgumentContext = jest.fn();
const getAncestorChain = jest.fn();
const getArgumentChildren = jest.fn();
const getHomeArgumentLists = jest.fn();
const listInitialArgumentSchemes = jest.fn();
const listVisibleCriticalQuestionsForArgument = jest.fn();
const listVisibleResponseSchemesForArgumentCq = jest.fn();

jest.unstable_mockModule("../../../src/modules/argumentation/argument.service.js", () => ({
  submitInitialArgument,
  submitCounterArgument,
  previewArgumentText,
  discardArgumentTextPreview,
  getSubtopicGraph,
  getEnrichedArgument,
  getArgumentContext,
  getAncestorChain,
  getArgumentChildren,
  getHomeArgumentLists,
  listInitialArgumentSchemes,
  listVisibleCriticalQuestionsForArgument,
  listVisibleResponseSchemesForArgumentCq,
}));

const renderArgumentNL = jest.fn();
jest.unstable_mockModule("../../../src/modules/argumentation/nlrender.js", () => ({
  renderArgumentNL,
}));

const suggestSchemes = jest.fn();
jest.unstable_mockModule("../../../src/modules/argumentation/scheme-suggester.js", () => ({
  suggestSchemes,
}));

const getAuthenticatedUser = jest.fn();
jest.unstable_mockModule("../../../src/utils/auth.js", () => ({
  getAuthenticatedUser,
}));

const callMistral = jest.fn();
jest.unstable_mockModule("../../../src/modules/argumentation/llm/mistral.js", () => ({
  callMistral,
}));

type ArgumentRoutes = typeof import("../../../src/modules/argumentation/argument.routes.js");

let argumentRoutes: ArgumentRoutes["argumentRoutes"];

const authUser = {
  id: 42,
  username: "u",
  email: "u@e.com",
  createdAt: new Date(),
  isAdmin: false,
};

function validInitialBody() {
  return {
    schemeId: "expert_opinion",
    subtopicId: 1,
    textPreviewToken: "tok",
    selectedOptionId: "opt-a",
    variables: [
      { variableId: "expert", value: "Dr" },
      { variableId: "domain", value: "dom" },
      { variableId: "claim", value: "c" },
    ],
  };
}

function validCounterBody() {
  return {
    schemeId: "position_to_know",
    selectedCqId: "cq_eo_1",
    parentArgumentId: "p1",
    textPreviewToken: "tok2",
    selectedOptionId: "opt-b",
    variables: [
      { variableId: "source", value: "s" },
      { variableId: "domain", value: "d" },
      { variableId: "claim", value: "c" },
    ],
  };
}

function validTextOptionsBody() {
  return {
    kind: "initial" as const,
    schemeId: "expert_opinion",
    subtopicId: 1,
    variables: [
      { variableId: "expert", value: "E" },
      { variableId: "domain", value: "D" },
      { variableId: "claim", value: "C" },
    ],
  };
}

function validPreviewResponse() {
  return {
    previewToken: "pt",
    options: [
      { id: "o1", text: "v1" },
      { id: "o2", text: "v2" },
      { id: "o3", text: "v3" },
    ],
    fallback: "fb",
  };
}

beforeEach(async () => {
  [
    getArgumentById,
    submitInitialArgument,
    submitCounterArgument,
    previewArgumentText,
    discardArgumentTextPreview,
    getSubtopicGraph,
    getEnrichedArgument,
    getArgumentContext,
    getAncestorChain,
    getArgumentChildren,
    getHomeArgumentLists,
    listInitialArgumentSchemes,
    listVisibleCriticalQuestionsForArgument,
    listVisibleResponseSchemesForArgumentCq,
    renderArgumentNL,
    suggestSchemes,
    getAuthenticatedUser,
    callMistral,
  ].forEach((m) => m.mockReset());

  jest.resetModules();
  jest.unstable_mockModule("../../../src/modules/argumentation/argument.repository.js", () => ({
    getArgumentById,
  }));
  jest.unstable_mockModule("../../../src/modules/argumentation/argument.service.js", () => ({
    submitInitialArgument,
    submitCounterArgument,
    previewArgumentText,
    discardArgumentTextPreview,
    getSubtopicGraph,
    getEnrichedArgument,
    getArgumentContext,
    getAncestorChain,
    getArgumentChildren,
    getHomeArgumentLists,
    listInitialArgumentSchemes,
    listVisibleCriticalQuestionsForArgument,
    listVisibleResponseSchemesForArgumentCq,
  }));
  jest.unstable_mockModule("../../../src/modules/argumentation/nlrender.js", () => ({
    renderArgumentNL,
  }));
  jest.unstable_mockModule("../../../src/modules/argumentation/scheme-suggester.js", () => ({
    suggestSchemes,
  }));
  jest.unstable_mockModule("../../../src/utils/auth.js", () => ({
    getAuthenticatedUser,
  }));
  jest.unstable_mockModule("../../../src/modules/argumentation/llm/mistral.js", () => ({
    callMistral,
  }));

  const mod =
    (await import("../../../src/modules/argumentation/argument.routes.js")) as ArgumentRoutes;
  argumentRoutes = mod.argumentRoutes;
});

async function registerRoutes(): Promise<MockFastifyInstance> {
  const fastify = buildFastifyMock();
  await argumentRoutes(fastify as never);
  return fastify;
}

describe("argument.routes", () => {
  describe("POST /arguments/initial", () => {
    it("returns early when the user is not authenticated", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/initial",
      )(buildRequestMock({ body: validInitialBody() }), reply);

      expect(submitInitialArgument).not.toHaveBeenCalled();
    });

    it("returns 400 when body validation fails", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/initial",
      )(buildRequestMock({ body: { schemeId: "x" }, userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(submitInitialArgument).not.toHaveBeenCalled();
    });

    it("returns 201 with the created argument", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const created = { id: "new", schemeId: "expert_opinion" };
      submitInitialArgument.mockResolvedValue(created);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/initial",
      )(buildRequestMock({ body: validInitialBody(), userId: 42 }), reply);

      expect(submitInitialArgument).toHaveBeenCalledWith(validInitialBody(), 42);
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(created);
    });

    it("returns 400 with a string message when submit throws a non-Error", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      submitInitialArgument.mockRejectedValue("boom");
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/initial",
      )(buildRequestMock({ body: validInitialBody(), userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: "Bad request" });
    });

    it("returns 400 with Error message when submit throws", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      submitInitialArgument.mockRejectedValue(new Error("bad subtopic"));
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/initial",
      )(buildRequestMock({ body: validInitialBody(), userId: 42 }), reply);

      expect(reply.send).toHaveBeenCalledWith({ error: "bad subtopic" });
    });
  });

  describe("POST /arguments/counter", () => {
    it("skips submit when unauthenticated", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(null);

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/counter",
      )(buildRequestMock({ body: validCounterBody() }), buildReplyMock());

      expect(submitCounterArgument).not.toHaveBeenCalled();
    });

    it("returns 400 on invalid body", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/counter",
      )(buildRequestMock({ body: {}, userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it("returns 201 on success", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const created = { id: "c1" };
      submitCounterArgument.mockResolvedValue(created);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/counter",
      )(buildRequestMock({ body: validCounterBody(), userId: 42 }), reply);

      expect(submitCounterArgument).toHaveBeenCalledWith(validCounterBody(), 42);
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(created);
    });

    it("returns 400 with Bad request when counter submit throws a non-Error", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      submitCounterArgument.mockRejectedValue("fail");
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/counter",
      )(buildRequestMock({ body: validCounterBody(), userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: "Bad request" });
    });

    it("returns 400 with Error message when counter submit throws", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      submitCounterArgument.mockRejectedValue(new Error("counter bad"));
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/counter",
      )(buildRequestMock({ body: validCounterBody(), userId: 42 }), reply);

      expect(reply.send).toHaveBeenCalledWith({ error: "counter bad" });
    });
  });

  describe("POST /arguments/text-options", () => {
    it("requires authentication", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(null);
      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options",
      )(buildRequestMock({ body: validTextOptionsBody() }), buildReplyMock());
      expect(previewArgumentText).not.toHaveBeenCalled();
    });

    it("returns 400 when preview request is invalid", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options",
      )(buildRequestMock({ body: { kind: "initial" }, userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it("returns parsed preview payload on success", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const payload = validPreviewResponse();
      previewArgumentText.mockResolvedValue(payload);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options",
      )(buildRequestMock({ body: validTextOptionsBody(), userId: 42 }), reply);

      expect(reply.send).toHaveBeenCalledWith(payload);
      expect(previewArgumentText).toHaveBeenCalledWith(validTextOptionsBody(), 42);
    });

    it("returns 422 when variable moderation fails", async () => {
      const { ModerationFailedError } =
        await import("../../../src/modules/argumentation/llm/moderation.js");
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      previewArgumentText.mockRejectedValue(
        new ModerationFailedError([
          { variableId: "claim", reason: "Incoherent value for this slot." },
        ]),
      );
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options",
      )(buildRequestMock({ body: validTextOptionsBody(), userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(422);
      expect(reply.send).toHaveBeenCalledWith({
        error: "moderation_failed",
        violations: [{ variableId: "claim", reason: "Incoherent value for this slot." }],
      });
    });

    it("maps preview failures to 400", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      previewArgumentText.mockRejectedValue(new Error("scheme"));
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options",
      )(buildRequestMock({ body: validTextOptionsBody(), userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when response schema validation fails", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      previewArgumentText.mockResolvedValue({ previewToken: "x" });
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options",
      )(buildRequestMock({ body: validTextOptionsBody(), userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it("returns Bad request when preview throws a non-Error", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      previewArgumentText.mockRejectedValue("nope");
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options",
      )(buildRequestMock({ body: validTextOptionsBody(), userId: 42 }), reply);

      expect(reply.send).toHaveBeenCalledWith({ error: "Bad request" });
    });
  });

  describe("POST /arguments/text-options/release", () => {
    it("returns early when unauthenticated", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(null);

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options/release",
      )(buildRequestMock({ body: { previewToken: "t" }, userId: 42 }), buildReplyMock());

      expect(discardArgumentTextPreview).not.toHaveBeenCalled();
    });

    it("returns 204 after discarding the preview", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options/release",
      )(buildRequestMock({ body: { previewToken: "t" }, userId: 42 }), reply);

      expect(discardArgumentTextPreview).toHaveBeenCalledWith("t", 42);
      expect(reply.status).toHaveBeenCalledWith(204);
    });

    it("returns 400 for invalid release body", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/text-options/release",
      )(buildRequestMock({ body: {}, userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe("GET /subtopics/:subtopicId/arguments", () => {
    it("returns 400 when subtopicId is not numeric", async () => {
      const fastify = await registerRoutes();
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/subtopics/:subtopicId/arguments",
      )(buildRequestMock({ params: { subtopicId: "nan" } }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(getSubtopicGraph).not.toHaveBeenCalled();
    });

    it("returns graph data on success", async () => {
      const fastify = await registerRoutes();
      const rows = [{ id: "a" }];
      getSubtopicGraph.mockResolvedValue(rows);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/subtopics/:subtopicId/arguments",
      )(buildRequestMock({ params: { subtopicId: "3" } }), reply);

      expect(getSubtopicGraph).toHaveBeenCalledWith(3);
      expect(reply.send).toHaveBeenCalledWith(rows);
    });

    it("returns 500 when the service throws a non-Error", async () => {
      const fastify = await registerRoutes();
      getSubtopicGraph.mockRejectedValue("db");
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/subtopics/:subtopicId/arguments",
      )(buildRequestMock({ params: { subtopicId: "1" } }), reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({ error: "Internal error" });
    });

    it("returns 500 with Error message when the service throws", async () => {
      const fastify = await registerRoutes();
      getSubtopicGraph.mockRejectedValue(new Error("db down"));
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/subtopics/:subtopicId/arguments",
      )(buildRequestMock({ params: { subtopicId: "1" } }), reply);

      expect(reply.send).toHaveBeenCalledWith({ error: "db down" });
    });
  });

  describe("GET /arguments/:id", () => {
    it("returns 404 when missing", async () => {
      const fastify = await registerRoutes();
      getEnrichedArgument.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id",
      )(buildRequestMock({ params: { id: "x" } }), reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("returns the enriched argument", async () => {
      const fastify = await registerRoutes();
      const arg = { id: "x", childrenByStatus: { in: [], out: [], undecided: [] } };
      getEnrichedArgument.mockResolvedValue(arg);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id",
      )(buildRequestMock({ params: { id: "x" } }), reply);

      expect(reply.send).toHaveBeenCalledWith(arg);
    });
  });

  describe("GET /arguments/:id/render", () => {
    it("returns 404 when argument is missing", async () => {
      const fastify = await registerRoutes();
      getEnrichedArgument.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/render",
      )(buildRequestMock({ params: { id: "n" } }), reply);

      expect(renderArgumentNL).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("returns parsed NL render payload", async () => {
      const fastify = await registerRoutes();
      getEnrichedArgument.mockResolvedValue({ id: "a1" });
      renderArgumentNL.mockResolvedValue({ prose: "Rendered prose." });
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/render",
      )(buildRequestMock({ params: { id: "a1" } }), reply);

      expect(renderArgumentNL).toHaveBeenCalledWith("a1");
      expect(reply.send).toHaveBeenCalledWith({ prose: "Rendered prose." });
    });
  });

  describe("GET /arguments/:id/context", () => {
    it("returns 404 when context is missing", async () => {
      const fastify = await registerRoutes();
      getArgumentContext.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/context",
      )(buildRequestMock({ params: { id: "z" } }), reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("returns context payload", async () => {
      const fastify = await registerRoutes();
      const ctx = {
        argument: { id: "z" },
        subtopic: { id: 1 },
        topic: { id: 2 },
      };
      getArgumentContext.mockResolvedValue(ctx);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/context",
      )(buildRequestMock({ params: { id: "z" } }), reply);

      expect(reply.send).toHaveBeenCalledWith(ctx);
    });
  });

  describe("GET /arguments/:id/ancestors", () => {
    it("returns 404 when chain is missing", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/ancestors",
      )(buildRequestMock({ params: { id: "z" } }), reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("returns wrapped ancestors", async () => {
      const fastify = await registerRoutes();
      const chain = [
        {
          id: "r",
          schemeId: "expert_opinion",
          argumentText: "t",
          isInitial: true,
          status: "IN" as const,
          parentId: null,
        },
      ];
      getAncestorChain.mockResolvedValue(chain);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/ancestors",
      )(buildRequestMock({ params: { id: "r" } }), reply);

      expect(reply.send).toHaveBeenCalledWith({ ancestors: chain });
    });
  });

  describe("GET /arguments/:id/children", () => {
    it("caps limit between 1 and 50", async () => {
      const fastify = await registerRoutes();
      getArgumentChildren.mockResolvedValue({ children: [], nextCursor: null });

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/children",
      )(
        buildRequestMock({
          params: { id: "p" },
          query: { limit: "999", sort: "oldest" },
        }),
        buildReplyMock(),
      );

      expect(getArgumentChildren).toHaveBeenCalledWith("p", "oldest", 50, undefined);
    });

    it("returns 400 for invalid sort", async () => {
      const fastify = await registerRoutes();
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/children",
      )(
        buildRequestMock({
          params: { id: "p" },
          query: { sort: "not-a-sort" },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(getArgumentChildren).not.toHaveBeenCalled();
    });

    it("returns 404 when the parent argument is missing", async () => {
      const fastify = await registerRoutes();
      getArgumentChildren.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/children",
      )(buildRequestMock({ params: { id: "p" } }), reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("passes after cursor when provided", async () => {
      const fastify = await registerRoutes();
      const page = { children: [], nextCursor: null };
      getArgumentChildren.mockResolvedValue(page);

      await getRouteHandler(
        fastify,
        "GET",
        "/arguments/:id/children",
      )(
        buildRequestMock({
          params: { id: "p" },
          query: { after: "c1" },
        }),
        buildReplyMock(),
      );

      expect(getArgumentChildren).toHaveBeenCalledWith("p", "newest", 10, "c1");
    });
  });

  describe("POST /arguments/suggest", () => {
    it("returns early when unauthenticated", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(null);

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/suggest",
      )(buildRequestMock({ body: { text: "1234567890" }, userId: 42 }), buildReplyMock());

      expect(suggestSchemes).not.toHaveBeenCalled();
    });

    it("returns 400 when suggestion text is too short", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/suggest",
      )(buildRequestMock({ body: { text: "short" }, userId: 42 }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(suggestSchemes).not.toHaveBeenCalled();
    });

    it("returns 200 with parsed suggestions payload", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(authUser);
      const suggestions = {
        suggestions: [
          {
            schemeId: "expert_opinion",
            schemeName: "Expert Opinion",
            confidence: "high" as const,
            reasoning: "Because",
            prefillVariables: { expert: "E" },
          },
        ],
      };
      suggestSchemes.mockResolvedValue(suggestions);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/suggest",
      )(
        buildRequestMock({
          body: { text: "1234567890" },
          userId: 42,
        }),
        reply,
      );

      expect(suggestSchemes).toHaveBeenCalledWith("1234567890");
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(suggestions);
    });
  });

  describe("POST /arguments/path-dialogue", () => {
    const baseArg = (over: Record<string, unknown> = {}) =>
      ({
        id: "n1",
        schemeId: "expert_opinion",
        argumentText: "",
        isInitial: true,
        status: "IN",
        parentId: null,
        selectedCqId: null,
        variables: [{ variableId: "expert", value: "E" }],
        ...over,
      }) as never;

    it("returns 400 when body validation fails", async () => {
      const fastify = await registerRoutes();
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(buildRequestMock({ body: {} }), reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when end chain is missing", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "a", endArgumentId: "b" },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("returns 404 when end chain is empty", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([]);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "a", endArgumentId: "b" },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("returns 400 when start is not on the chain", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([
        {
          id: "only",
          schemeId: "expert_opinion",
          argumentText: "t",
          isInitial: true,
          status: "IN",
          parentId: null,
        },
      ]);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "missing", endArgumentId: "only" },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when a fetched argument row is missing", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([
        {
          id: "a",
          schemeId: "expert_opinion",
          argumentText: "t",
          isInitial: true,
          status: "IN",
          parentId: null,
        },
      ]);
      getArgumentById.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "a", endArgumentId: "a" },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("returns LLM dialogue on success", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([
        {
          id: "root",
          schemeId: "expert_opinion",
          argumentText: "Root says",
          isInitial: true,
          status: "IN",
          parentId: null,
        },
        {
          id: "child",
          schemeId: "position_to_know",
          argumentText: "",
          isInitial: false,
          status: "UNDECIDED",
          parentId: "root",
          selectedCqId: "cq_eo_1",
        },
      ]);
      getArgumentById.mockImplementation(async (id: string) => {
        if (id === "root") {
          return {
            ...baseArg({ id: "root", argumentText: "Root says" }),
            variables: [
              { variableId: "expert", value: "Dr" },
              { variableId: "domain", value: "d" },
              { variableId: "claim", value: "c" },
            ],
          };
        }
        return {
          ...baseArg({
            id: "child",
            schemeId: "position_to_know",
            isInitial: false,
            parentId: "root",
            selectedCqId: "cq_eo_1",
            argumentText: "",
          }),
          variables: [
            { variableId: "source", value: "s" },
            { variableId: "domain", value: "d" },
            { variableId: "claim", value: "c" },
          ],
        };
      });
      callMistral.mockResolvedValue("  Polished dialogue.  ");
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "root", endArgumentId: "child" },
        }),
        reply,
      );

      expect(callMistral).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith({
        dialogue: "Polished dialogue.",
        turnCount: 2,
      });
    });

    it("uses fallback dialogue when Mistral returns nullish", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([
        {
          id: "solo",
          schemeId: "unknown_scheme_id",
          argumentText: "Direct",
          isInitial: false,
          status: "OUT",
          parentId: null,
        },
      ]);
      getArgumentById.mockResolvedValue({
        id: "solo",
        schemeId: "unknown_scheme_id",
        argumentText: "Direct",
        isInitial: false,
        status: "OUT",
        parentId: null,
        selectedCqId: null,
        variables: [],
      } as never);
      callMistral.mockResolvedValue(null);
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "solo", endArgumentId: "solo" },
        }),
        reply,
      );

      const sent = (reply.send as jest.Mock).mock.calls[0][0] as {
        dialogue: string;
        turnCount: number;
      };
      expect(sent.turnCount).toBe(1);
      expect(sent.dialogue).toContain("Turn 1:");
    });

    it("uses fallback when Mistral throws", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([
        {
          id: "solo",
          schemeId: "expert_opinion",
          argumentText: "Hi",
          isInitial: true,
          status: "IN",
          parentId: null,
        },
      ]);
      getArgumentById.mockResolvedValue({
        id: "solo",
        schemeId: "expert_opinion",
        argumentText: "Hi",
        isInitial: true,
        status: "IN",
        parentId: null,
        selectedCqId: null,
        variables: [
          { variableId: "expert", value: "E" },
          { variableId: "domain", value: "D" },
          { variableId: "claim", value: "C" },
        ],
      } as never);
      callMistral.mockRejectedValue(new Error("network"));
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "solo", endArgumentId: "solo" },
        }),
        reply,
      );

      expect(reply.send).toHaveBeenCalled();
    });

    it("omits CQ line when the parent row is not in the loaded id set", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([
        {
          id: "child",
          schemeId: "position_to_know",
          argumentText: "C",
          isInitial: false,
          status: "UNDECIDED",
          parentId: "missing-root",
          selectedCqId: "cq_eo_1",
        },
      ]);
      getArgumentById.mockResolvedValue({
        id: "child",
        schemeId: "position_to_know",
        argumentText: "C",
        isInitial: false,
        status: "UNDECIDED",
        parentId: "missing-root",
        selectedCqId: "cq_eo_1",
        variables: [
          { variableId: "source", value: "S" },
          { variableId: "domain", value: "D" },
          { variableId: "claim", value: "C" },
        ],
      } as never);
      callMistral.mockResolvedValue("solo");

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "child", endArgumentId: "child" },
        }),
        buildReplyMock(),
      );

      expect(callMistral).toHaveBeenCalled();
    });

    it("omits CQ line when the CQ id is not valid for the parent scheme", async () => {
      const fastify = await registerRoutes();
      getAncestorChain.mockResolvedValue([
        {
          id: "root",
          schemeId: "expert_opinion",
          argumentText: "R",
          isInitial: true,
          status: "IN",
          parentId: null,
        },
        {
          id: "child",
          schemeId: "position_to_know",
          argumentText: "C",
          isInitial: false,
          status: "UNDECIDED",
          parentId: "root",
          selectedCqId: "not_a_real_cq",
        },
      ]);
      getArgumentById.mockImplementation(async (id: string) => {
        if (id === "root") {
          return {
            id: "root",
            schemeId: "expert_opinion",
            argumentText: "R",
            isInitial: true,
            status: "IN",
            parentId: null,
            selectedCqId: null,
            variables: [
              { variableId: "expert", value: "E" },
              { variableId: "domain", value: "D" },
              { variableId: "claim", value: "C" },
            ],
          } as never;
        }
        return {
          id: "child",
          schemeId: "position_to_know",
          argumentText: "C",
          isInitial: false,
          status: "UNDECIDED",
          parentId: "root",
          selectedCqId: "not_a_real_cq",
          variables: [
            { variableId: "source", value: "S" },
            { variableId: "domain", value: "D" },
            { variableId: "claim", value: "C" },
          ],
        } as never;
      });
      callMistral.mockResolvedValue("ok");
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "POST",
        "/arguments/path-dialogue",
      )(
        buildRequestMock({
          body: { startArgumentId: "root", endArgumentId: "child" },
        }),
        reply,
      );

      const sent = (reply.send as jest.Mock).mock.calls[0][0] as {
        dialogue: string;
      };
      expect(sent.dialogue).toContain("ok");
    });
  });
});
