import { prisma } from "@db/prisma.js";
import type { CreateTopic } from "@inch/types";

// Thin Prisma wrappers. Listings are newest first; the find* functions return
// null for unknown ids and leave the not-found decision to topic.service.ts.

export async function findAllTopics() {
  return prisma.topic.findMany({ orderBy: { createdAt: "desc" } });
}

export async function findTopicById(id: number) {
  return prisma.topic.findUnique({ where: { id } });
}

export async function insertTopic(data: CreateTopic) {
  return prisma.topic.create({ data });
}

export async function findSubtopicsByTopic(topicId: number) {
  return prisma.subtopic.findMany({
    where: { topicId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findSubtopicById(id: number) {
  return prisma.subtopic.findUnique({ where: { id } });
}

export async function insertSubtopic(data: { topicId: number; title: string }) {
  return prisma.subtopic.create({ data });
}
