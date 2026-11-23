import { z } from "zod";

export const CreateTopicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export const TopicSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const CreateSubtopicSchema = z.object({
  topicId: z.number(),
  title: z.string().min(1).max(200),
});

export const SubtopicSchema = z.object({
  id: z.number(),
  topicId: z.number(),
  title: z.string(),
  createdAt: z.string().datetime(),
});

export const CreateSubtopicBodySchema = z.object({
  title: z.string().min(1).max(200),
});

export type CreateTopic = z.infer<typeof CreateTopicSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type CreateSubtopic = z.infer<typeof CreateSubtopicSchema>;
export type CreateSubtopicBody = z.infer<typeof CreateSubtopicBodySchema>;
export type Subtopic = z.infer<typeof SubtopicSchema>;
