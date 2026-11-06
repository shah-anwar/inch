import type { CreateTopic } from "@inch/types";
import {
  findAllTopics,
  findTopicById,
  insertTopic,
  findSubtopicsByTopic,
  findSubtopicById,
  insertSubtopic,
} from "./topic.repository.js";

export async function getAllTopics() {
  return findAllTopics();
}

/** @throws {Error} "Topic not found", which the routes map to 404. */
export async function getTopicById(id: number) {
  const topic = await findTopicById(id);
  if (!topic) throw new Error("Topic not found");
  return topic;
}

export async function createTopic(data: CreateTopic) {
  return insertTopic(data);
}

/** Checks the topic exists first so an unknown topic is a 404, not an empty list. */
export async function getSubtopicsByTopic(topicId: number) {
  await getTopicById(topicId);
  return findSubtopicsByTopic(topicId);
}

/**
 * Also checks that the subtopic belongs to `topicId`, so a valid subtopic id
 * cannot be reached under the wrong topic URL.
 */
export async function getSubtopicById(topicId: number, subtopicId: number) {
  await getTopicById(topicId);
  const subtopic = await findSubtopicById(subtopicId);
  if (!subtopic || subtopic.topicId !== topicId) {
    throw new Error("Subtopic not found");
  }
  return subtopic;
}

/** @throws {Error} "Topic not found" when the parent topic does not exist. */
export async function createSubtopic(topicId: number, title: string) {
  await getTopicById(topicId);
  return insertSubtopic({ topicId, title });
}
