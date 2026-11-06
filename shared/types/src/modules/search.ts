import { z } from "zod";

export const SearchResultTopicSchema = z.object({
  type: z.literal("topic"),
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
});

export const SearchResultSubtopicSchema = z.object({
  type: z.literal("subtopic"),
  id: z.number(),
  topicId: z.number(),
  title: z.string(),
  topicTitle: z.string(),
});

export const SearchResultArgumentSchema = z.object({
  type: z.literal("argument"),
  id: z.string(),
  schemeId: z.string(),
  subtopicId: z.number(),
  subtopicTitle: z.string(),
  topicTitle: z.string(),
  renderedText: z.string(),
  status: z.enum(["IN", "OUT", "UNDECIDED"]),
});

export const SearchResultSchema = z.discriminatedUnion("type", [
  SearchResultTopicSchema,
  SearchResultSubtopicSchema,
  SearchResultArgumentSchema,
]);

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  total: z.number(),
  page: z.number(),
  totalPages: z.number(),
});

export type SearchResultTopic = z.infer<typeof SearchResultTopicSchema>;
export type SearchResultSubtopic = z.infer<typeof SearchResultSubtopicSchema>;
export type SearchResultArgument = z.infer<typeof SearchResultArgumentSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
