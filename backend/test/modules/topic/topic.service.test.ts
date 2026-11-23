import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const findAllTopics = jest.fn();
const findTopicById = jest.fn();
const insertTopic = jest.fn();
const findSubtopicsByTopic = jest.fn();
const findSubtopicById = jest.fn();
const insertSubtopic = jest.fn();

jest.unstable_mockModule("../../../src/modules/topic/topic.repository.js", () => ({
  findAllTopics,
  findTopicById,
  insertTopic,
  findSubtopicsByTopic,
  findSubtopicById,
  insertSubtopic,
}));

type TopicService = typeof import("../../../src/modules/topic/topic.service.js");

let topicService: TopicService;

beforeEach(async () => {
  findAllTopics.mockReset();
  findTopicById.mockReset();
  insertTopic.mockReset();
  findSubtopicsByTopic.mockReset();
  findSubtopicById.mockReset();
  insertSubtopic.mockReset();

  jest.resetModules();
  jest.unstable_mockModule("../../../src/modules/topic/topic.repository.js", () => ({
    findAllTopics,
    findTopicById,
    insertTopic,
    findSubtopicsByTopic,
    findSubtopicById,
    insertSubtopic,
  }));

  topicService = await import("../../../src/modules/topic/topic.service.js");
});

describe("topic.service", () => {
  describe("getAllTopics", () => {
    it("returns topics from findAllTopics", async () => {
      const topics = [{ id: 1, title: "A" }];
      findAllTopics.mockResolvedValue(topics);

      await expect(topicService.getAllTopics()).resolves.toBe(topics);
      expect(findAllTopics).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTopicById", () => {
    it("returns the topic when found", async () => {
      const topic = { id: 5, title: "T" };
      findTopicById.mockResolvedValue(topic);

      await expect(topicService.getTopicById(5)).resolves.toBe(topic);
      expect(findTopicById).toHaveBeenCalledWith(5);
    });

    it('throws "Topic not found" when the topic is null', async () => {
      findTopicById.mockResolvedValue(null);

      await expect(topicService.getTopicById(99)).rejects.toThrow("Topic not found");
      expect(findTopicById).toHaveBeenCalledWith(99);
    });
  });

  describe("createTopic", () => {
    it("delegates to insertTopic with data", async () => {
      const data = { title: "New" };
      const created = { id: 2, title: "New" };
      insertTopic.mockResolvedValue(created);

      await expect(topicService.createTopic(data)).resolves.toBe(created);
      expect(insertTopic).toHaveBeenCalledWith(data);
    });
  });

  describe("getSubtopicsByTopic", () => {
    it("returns subtopics after verifying the parent topic exists", async () => {
      const topic = { id: 3, title: "Parent" };
      const subtopics = [{ id: 10, topicId: 3, title: "S" }];
      findTopicById.mockResolvedValue(topic);
      findSubtopicsByTopic.mockResolvedValue(subtopics);

      await expect(topicService.getSubtopicsByTopic(3)).resolves.toBe(subtopics);
      expect(findTopicById).toHaveBeenCalledWith(3);
      expect(findSubtopicsByTopic).toHaveBeenCalledWith(3);
    });

    it("rethrows when the parent topic is missing", async () => {
      findTopicById.mockResolvedValue(null);

      await expect(topicService.getSubtopicsByTopic(404)).rejects.toThrow("Topic not found");
      expect(findSubtopicsByTopic).not.toHaveBeenCalled();
    });
  });

  describe("getSubtopicById", () => {
    it("returns the subtopic when it exists under the topic", async () => {
      const topic = { id: 2, title: "P" };
      const subtopic = { id: 8, topicId: 2, title: "Child" };
      findTopicById.mockResolvedValue(topic);
      findSubtopicById.mockResolvedValue(subtopic);

      await expect(topicService.getSubtopicById(2, 8)).resolves.toBe(subtopic);
      expect(findTopicById).toHaveBeenCalledWith(2);
      expect(findSubtopicById).toHaveBeenCalledWith(8);
    });

    it('throws "Subtopic not found" when the subtopic row is null', async () => {
      findTopicById.mockResolvedValue({ id: 2, title: "P" });
      findSubtopicById.mockResolvedValue(null);

      await expect(topicService.getSubtopicById(2, 8)).rejects.toThrow("Subtopic not found");
    });

    it('throws "Subtopic not found" when the subtopic belongs to a different topic', async () => {
      findTopicById.mockResolvedValue({ id: 2, title: "P" });
      findSubtopicById.mockResolvedValue({
        id: 8,
        topicId: 999,
        title: "Wrong parent",
      });

      await expect(topicService.getSubtopicById(2, 8)).rejects.toThrow("Subtopic not found");
    });

    it("rethrows when the parent topic is missing before loading the subtopic", async () => {
      findTopicById.mockResolvedValue(null);

      await expect(topicService.getSubtopicById(2, 8)).rejects.toThrow("Topic not found");
      expect(findSubtopicById).not.toHaveBeenCalled();
    });
  });

  describe("createSubtopic", () => {
    it("creates a subtopic after verifying the parent topic exists", async () => {
      const topic = { id: 4, title: "P" };
      const created = { id: 20, topicId: 4, title: "New sub" };
      findTopicById.mockResolvedValue(topic);
      insertSubtopic.mockResolvedValue(created);

      await expect(topicService.createSubtopic(4, "New sub")).resolves.toBe(created);
      expect(findTopicById).toHaveBeenCalledWith(4);
      expect(insertSubtopic).toHaveBeenCalledWith({
        topicId: 4,
        title: "New sub",
      });
    });

    it("rethrows when the parent topic is missing", async () => {
      findTopicById.mockResolvedValue(null);

      await expect(topicService.createSubtopic(4, "X")).rejects.toThrow("Topic not found");
      expect(insertSubtopic).not.toHaveBeenCalled();
    });
  });
});
