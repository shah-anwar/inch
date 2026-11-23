import { CreateTopicSchema, CreateSubtopicBodySchema } from "@inch/types";
import type { FastifyInstance } from "fastify";
import {
  getAllTopics,
  getTopicById,
  createTopic,
  getSubtopicsByTopic,
  getSubtopicById,
  createSubtopic,
} from "./topic.service.js";
import { getAuthenticatedUser } from "../../utils/auth.js";

/**
 * Registers topic and subtopic REST endpoints.
 *
 * Endpoints include read operations for topic browsing and authenticated writes
 * for creating topics and subtopics.
 *
 * @param fastify Fastify instance used to register HTTP routes.
 * @returns Resolves after route registration.
 */
export async function topicRoutes(fastify: FastifyInstance) {
  // GET /topics — list all topics
  fastify.get("/topics", async (_request, reply) => {
    const topics = await getAllTopics();
    return reply.send(topics);
  });

  // GET /topics/:topicId — single topic
  fastify.get("/topics/:topicId", async (request, reply) => {
    const { topicId } = request.params as { topicId: string };
    const id = Number(topicId);
    if (isNaN(id)) {
      return reply.status(400).send({ error: "Invalid topicId" });
    }

    try {
      const topic = await getTopicById(id);
      return reply.send(topic);
    } catch {
      return reply.status(404).send({ error: "Topic not found" });
    }
  });

  // POST /topics — create topic (auth required)
  fastify.post("/topics", async (request, reply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const result = CreateTopicSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    const topic = await createTopic(result.data);
    return reply.status(201).send(topic);
  });

  // GET /topics/:topicId/subtopics — list subtopics under a topic
  fastify.get("/topics/:topicId/subtopics", async (request, reply) => {
    const { topicId } = request.params as { topicId: string };
    const id = Number(topicId);
    if (isNaN(id)) {
      return reply.status(400).send({ error: "Invalid topicId" });
    }

    try {
      const subtopics = await getSubtopicsByTopic(id);
      return reply.send(subtopics);
    } catch {
      return reply.status(404).send({ error: "Topic not found" });
    }
  });

  // GET /topics/:topicId/subtopics/:subtopicId — single subtopic
  fastify.get("/topics/:topicId/subtopics/:subtopicId", async (request, reply) => {
    const { topicId, subtopicId } = request.params as {
      topicId: string;
      subtopicId: string;
    };
    const tId = Number(topicId);
    const sId = Number(subtopicId);
    if (isNaN(tId) || isNaN(sId)) {
      return reply.status(400).send({ error: "Invalid path parameters" });
    }

    try {
      const subtopic = await getSubtopicById(tId, sId);
      return reply.send(subtopic);
    } catch {
      return reply.status(404).send({ error: "Subtopic not found" });
    }
  });

  // POST /topics/:topicId/subtopics — create subtopic (auth required)
  fastify.post("/topics/:topicId/subtopics", async (request, reply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const { topicId } = request.params as { topicId: string };
    const tId = Number(topicId);
    if (isNaN(tId)) {
      return reply.status(400).send({ error: "Invalid topicId" });
    }

    const result = CreateSubtopicBodySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    try {
      const subtopic = await createSubtopic(tId, result.data.title);
      return reply.status(201).send(subtopic);
    } catch {
      return reply.status(404).send({ error: "Topic not found" });
    }
  });
}
