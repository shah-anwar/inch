import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { buildPrismaMock, resetPrismaMock, type MockPrisma } from "../../setup/mocks/prisma.js";

const prismaMock = buildPrismaMock();

jest.unstable_mockModule("@db/prisma.js", () => ({
  prisma: prismaMock,
}));

type TopicRepository = typeof import("../../../src/modules/topic/topic.repository.js");

let topicRepository: TopicRepository;

beforeEach(async () => {
  resetPrismaMock(prismaMock);
  jest.resetModules();
  jest.unstable_mockModule("@db/prisma.js", () => ({
    prisma: prismaMock,
  }));
  topicRepository = await import("../../../src/modules/topic/topic.repository.js");
});

describe("topic.repository", () => {
  describe("findAllTopics", () => {
    it("calls prisma.topic.findMany with newest-first order and returns the result", async () => {
      const rows = [{ id: 1, title: "A" }];
      prismaMock.topic.findMany.mockResolvedValue(rows);

      const result = await topicRepository.findAllTopics();

      expect(prismaMock.topic.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.topic.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
      expect(result).toBe(rows);
    });
  });

  describe("findTopicById", () => {
    it("calls prisma.topic.findUnique with the id and returns the result", async () => {
      const row = { id: 42, title: "T" };
      prismaMock.topic.findUnique.mockResolvedValue(row);

      const result = await topicRepository.findTopicById(42);

      expect(prismaMock.topic.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.topic.findUnique).toHaveBeenCalledWith({
        where: { id: 42 },
      });
      expect(result).toBe(row);
    });
  });

  describe("insertTopic", () => {
    it("calls prisma.topic.create with data and returns the result", async () => {
      const data = { title: "New topic" };
      const created = { id: 9, ...data };
      prismaMock.topic.create.mockResolvedValue(created);

      const result = await topicRepository.insertTopic(data);

      expect(prismaMock.topic.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.topic.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(created);
    });
  });

  describe("findSubtopicsByTopic", () => {
    it("calls prisma.subtopic.findMany with topicId filter and order and returns the result", async () => {
      const rows = [{ id: 1, topicId: 3, title: "S" }];
      prismaMock.subtopic.findMany.mockResolvedValue(rows);

      const result = await topicRepository.findSubtopicsByTopic(3);

      expect(prismaMock.subtopic.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.subtopic.findMany).toHaveBeenCalledWith({
        where: { topicId: 3 },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toBe(rows);
    });
  });

  describe("findSubtopicById", () => {
    it("calls prisma.subtopic.findUnique with the id and returns the result", async () => {
      const row = { id: 7, topicId: 1, title: "Sub" };
      prismaMock.subtopic.findUnique.mockResolvedValue(row);

      const result = await topicRepository.findSubtopicById(7);

      expect(prismaMock.subtopic.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.subtopic.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
      });
      expect(result).toBe(row);
    });
  });

  describe("insertSubtopic", () => {
    it("calls prisma.subtopic.create with data and returns the result", async () => {
      const data = { topicId: 2, title: "Child" };
      const created = { id: 11, ...data };
      prismaMock.subtopic.create.mockResolvedValue(created);

      const result = await topicRepository.insertSubtopic(data);

      expect(prismaMock.subtopic.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.subtopic.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(created);
    });
  });
});
