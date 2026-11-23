import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import {
  buildFastifyMock,
  buildReplyMock,
  buildRequestMock,
  getRouteHandler,
  type MockFastifyInstance,
} from "../../setup/mocks/fastify.js";

const getAllTopics = jest.fn();
const getTopicById = jest.fn();
const createTopic = jest.fn();
const getSubtopicsByTopic = jest.fn();
const getSubtopicById = jest.fn();
const createSubtopic = jest.fn();

jest.unstable_mockModule("../../../src/modules/topic/topic.service.js", () => ({
  getAllTopics,
  getTopicById,
  createTopic,
  getSubtopicsByTopic,
  getSubtopicById,
  createSubtopic,
}));

const getAuthenticatedUser = jest.fn();

jest.unstable_mockModule("../../../src/utils/auth.js", () => ({
  getAuthenticatedUser,
}));

type TopicRoutesModule = typeof import("../../../src/modules/topic/topic.routes.js");

let topicRoutes: TopicRoutesModule["topicRoutes"];

beforeEach(async () => {
  getAllTopics.mockReset();
  getTopicById.mockReset();
  createTopic.mockReset();
  getSubtopicsByTopic.mockReset();
  getSubtopicById.mockReset();
  createSubtopic.mockReset();
  getAuthenticatedUser.mockReset();

  jest.resetModules();
  jest.unstable_mockModule("../../../src/modules/topic/topic.service.js", () => ({
    getAllTopics,
    getTopicById,
    createTopic,
    getSubtopicsByTopic,
    getSubtopicById,
    createSubtopic,
  }));
  jest.unstable_mockModule("../../../src/utils/auth.js", () => ({
    getAuthenticatedUser,
  }));

  const mod = (await import("../../../src/modules/topic/topic.routes.js")) as TopicRoutesModule;
  topicRoutes = mod.topicRoutes;
});

async function registerRoutes(): Promise<MockFastifyInstance> {
  const fastify = buildFastifyMock();
  await topicRoutes(fastify as never);
  return fastify;
}

const mockUser = {
  id: 1,
  username: "tester",
  email: "t@example.com",
  createdAt: new Date(),
  isAdmin: false,
};

describe("topic.routes", () => {
  describe("GET /topics", () => {
    it("sends all topics from the service", async () => {
      const fastify = await registerRoutes();
      const topics = [{ id: 1, title: "A" }];
      getAllTopics.mockResolvedValue(topics);
      const request = buildRequestMock();
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "GET", "/topics")(request, reply);

      expect(getAllTopics).toHaveBeenCalledTimes(1);
      expect(reply.send).toHaveBeenCalledWith(topics);
    });
  });

  describe("GET /topics/:topicId", () => {
    it("returns the topic when the id is valid", async () => {
      const fastify = await registerRoutes();
      const topic = { id: 7, title: "T" };
      getTopicById.mockResolvedValue(topic);
      const request = buildRequestMock({ params: { topicId: "7" } });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "GET", "/topics/:topicId")(request, reply);

      expect(getTopicById).toHaveBeenCalledWith(7);
      expect(reply.send).toHaveBeenCalledWith(topic);
    });

    it("returns 400 when topicId is not a number", async () => {
      const fastify = await registerRoutes();
      const request = buildRequestMock({ params: { topicId: "nope" } });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "GET", "/topics/:topicId")(request, reply);

      expect(getTopicById).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: "Invalid topicId" });
    });

    it("returns 404 when the topic lookup throws", async () => {
      const fastify = await registerRoutes();
      getTopicById.mockRejectedValue(new Error("Topic not found"));
      const request = buildRequestMock({ params: { topicId: "3" } });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "GET", "/topics/:topicId")(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({ error: "Topic not found" });
    });
  });

  describe("POST /topics", () => {
    it("returns early when the user is not authenticated", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(null);
      const request = buildRequestMock({
        body: { title: "X" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics")(request, reply);

      expect(createTopic).not.toHaveBeenCalled();
    });

    it("returns 400 when the body fails schema validation", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(mockUser);
      const request = buildRequestMock({ body: {} });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics")(request, reply);

      expect(createTopic).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      const payload = reply.send.mock.calls[0]?.[0] as {
        error: { path: (string | number)[] }[];
      };
      expect(Array.isArray(payload.error)).toBe(true);
      expect(payload.error.some((i) => i.path.includes("title"))).toBe(true);
    });

    it("creates a topic and responds with 201 when validation passes", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(mockUser);
      const created = { id: 9, title: "New", description: null };
      createTopic.mockResolvedValue(created);
      const request = buildRequestMock({
        body: { title: "New", description: "optional" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics")(request, reply);

      expect(createTopic).toHaveBeenCalledWith({
        title: "New",
        description: "optional",
      });
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(created);
    });
  });

  describe("GET /topics/:topicId/subtopics", () => {
    it("lists subtopics when the topic id is valid", async () => {
      const fastify = await registerRoutes();
      const rows = [{ id: 1, topicId: 2, title: "S" }];
      getSubtopicsByTopic.mockResolvedValue(rows);
      const request = buildRequestMock({ params: { topicId: "2" } });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "GET", "/topics/:topicId/subtopics")(request, reply);

      expect(getSubtopicsByTopic).toHaveBeenCalledWith(2);
      expect(reply.send).toHaveBeenCalledWith(rows);
    });

    it("returns 400 when topicId is not numeric", async () => {
      const fastify = await registerRoutes();
      const request = buildRequestMock({ params: { topicId: "x" } });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "GET", "/topics/:topicId/subtopics")(request, reply);

      expect(getSubtopicsByTopic).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: "Invalid topicId" });
    });

    it("returns 404 when loading subtopics fails", async () => {
      const fastify = await registerRoutes();
      getSubtopicsByTopic.mockRejectedValue(new Error("Topic not found"));
      const request = buildRequestMock({ params: { topicId: "1" } });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "GET", "/topics/:topicId/subtopics")(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({ error: "Topic not found" });
    });
  });

  describe("GET /topics/:topicId/subtopics/:subtopicId", () => {
    it("returns the subtopic when path ids are valid", async () => {
      const fastify = await registerRoutes();
      const sub = { id: 5, topicId: 2, title: "Child" };
      getSubtopicById.mockResolvedValue(sub);
      const request = buildRequestMock({
        params: { topicId: "2", subtopicId: "5" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/topics/:topicId/subtopics/:subtopicId",
      )(request, reply);

      expect(getSubtopicById).toHaveBeenCalledWith(2, 5);
      expect(reply.send).toHaveBeenCalledWith(sub);
    });

    it("returns 400 when topicId is not numeric", async () => {
      const fastify = await registerRoutes();
      const request = buildRequestMock({
        params: { topicId: "bad", subtopicId: "1" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/topics/:topicId/subtopics/:subtopicId",
      )(request, reply);

      expect(getSubtopicById).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: "Invalid path parameters",
      });
    });

    it("returns 400 when subtopicId is not numeric", async () => {
      const fastify = await registerRoutes();
      const request = buildRequestMock({
        params: { topicId: "1", subtopicId: "bad" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/topics/:topicId/subtopics/:subtopicId",
      )(request, reply);

      expect(getSubtopicById).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: "Invalid path parameters",
      });
    });

    it("returns 404 when getSubtopicById throws", async () => {
      const fastify = await registerRoutes();
      getSubtopicById.mockRejectedValue(new Error("Subtopic not found"));
      const request = buildRequestMock({
        params: { topicId: "1", subtopicId: "2" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(
        fastify,
        "GET",
        "/topics/:topicId/subtopics/:subtopicId",
      )(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({ error: "Subtopic not found" });
    });
  });

  describe("POST /topics/:topicId/subtopics", () => {
    it("returns early when the user is not authenticated", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(null);
      const request = buildRequestMock({
        params: { topicId: "1" },
        body: { title: "S" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics/:topicId/subtopics")(request, reply);

      expect(createSubtopic).not.toHaveBeenCalled();
    });

    it("returns 400 when topicId in the path is not numeric", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(mockUser);
      const request = buildRequestMock({
        params: { topicId: "nan" },
        body: { title: "S" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics/:topicId/subtopics")(request, reply);

      expect(createSubtopic).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: "Invalid topicId" });
    });

    it("returns 400 when the body fails schema validation", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(mockUser);
      const request = buildRequestMock({
        params: { topicId: "3" },
        body: {},
      });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics/:topicId/subtopics")(request, reply);

      expect(createSubtopic).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      const payload = reply.send.mock.calls[0]?.[0] as {
        error: { path: (string | number)[] }[];
      };
      expect(Array.isArray(payload.error)).toBe(true);
      expect(payload.error.some((i) => i.path.includes("title"))).toBe(true);
    });

    it("creates a subtopic and responds with 201 on success", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(mockUser);
      const created = { id: 12, topicId: 3, title: "New" };
      createSubtopic.mockResolvedValue(created);
      const request = buildRequestMock({
        params: { topicId: "3" },
        body: { title: "New" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics/:topicId/subtopics")(request, reply);

      expect(createSubtopic).toHaveBeenCalledWith(3, "New");
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(created);
    });

    it("returns 404 when createSubtopic throws (missing parent topic)", async () => {
      const fastify = await registerRoutes();
      getAuthenticatedUser.mockResolvedValue(mockUser);
      createSubtopic.mockRejectedValue(new Error("Topic not found"));
      const request = buildRequestMock({
        params: { topicId: "3" },
        body: { title: "New" },
      });
      const reply = buildReplyMock();

      await getRouteHandler(fastify, "POST", "/topics/:topicId/subtopics")(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({ error: "Topic not found" });
    });
  });
});
