import { z } from "zod";

export const ArgumentVariableValueSchema = z.object({
  variableId: z.string().min(1),
  value: z.string(),
});

export const CreateInitialArgumentSchema = z.object({
  schemeId: z.string().min(1),
  subtopicId: z.number().int().positive(),
  textPreviewToken: z.string().min(1),
  selectedOptionId: z.string().min(1),
  variables: z.array(ArgumentVariableValueSchema),
});

export const CreateCounterArgumentSchema = z.object({
  schemeId: z.string().min(1),
  selectedCqId: z.string().min(1),
  parentArgumentId: z.string().min(1),
  textPreviewToken: z.string().min(1),
  selectedOptionId: z.string().min(1),
  variables: z.array(ArgumentVariableValueSchema),
});

export type CreateInitialArgument = z.infer<typeof CreateInitialArgumentSchema>;
export type CreateCounterArgument = z.infer<typeof CreateCounterArgumentSchema>;

// ---------------------------------------------------------------------------
// Enriched response schemas
// ---------------------------------------------------------------------------

import { SubtopicSchema, TopicSchema } from "./topic.js";

export const ChildrenByStatusSchema = z.object({
  in: z.array(z.string()),
  undecided: z.array(z.string()),
  out: z.array(z.string()),
});
export type ChildrenByStatus = z.infer<typeof ChildrenByStatusSchema>;

export const ArgumentWithChildrenByStatusSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  selectedCqId: z.string().nullable(),
  argumentText: z.string(),
  isInitial: z.boolean(),
  parentId: z.string().nullable(),
  parentType: z.enum(["SUBTOPIC", "ARGUMENT"]),
  subtopicId: z.number(),
  status: z.enum(["IN", "OUT", "UNDECIDED"]),
  childIds: z.array(z.string()),
  childrenByStatus: ChildrenByStatusSchema,
  descendantCount: z.number(),
  viewCount: z.number(),
  authorId: z.number(),
  createdAt: z.coerce.string(),
  variables: z.array(
    z.object({
      id: z.number(),
      argumentId: z.string(),
      variableId: z.string(),
      value: z.string(),
    }),
  ),
});
export type ArgumentWithChildrenByStatus = z.infer<typeof ArgumentWithChildrenByStatusSchema>;

export const ArgumentContextSchema = z.object({
  argument: ArgumentWithChildrenByStatusSchema,
  subtopic: SubtopicSchema,
  topic: TopicSchema,
});
export type ArgumentContext = z.infer<typeof ArgumentContextSchema>;

export const AncestorNodeSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  argumentText: z.string(),
  isInitial: z.boolean(),
  status: z.enum(["IN", "OUT", "UNDECIDED"]),
  parentId: z.string().nullable(),
});
export type AncestorNode = z.infer<typeof AncestorNodeSchema>;

export const AncestorChainSchema = z.object({
  ancestors: z.array(AncestorNodeSchema),
});
export type AncestorChain = z.infer<typeof AncestorChainSchema>;

export const ChildrenSortSchema = z.enum([
  "newest",
  "oldest",
  "most_descendants",
  "status",
  "most_viewed",
]);
export type ChildrenSort = z.infer<typeof ChildrenSortSchema>;

export const PaginatedChildrenSchema = z.object({
  children: z.array(ArgumentWithChildrenByStatusSchema),
  nextCursor: z.string().nullable(),
});
export type PaginatedChildren = z.infer<typeof PaginatedChildrenSchema>;

// ---------------------------------------------------------------------------
// Home page argument lists (public)
// ---------------------------------------------------------------------------

export const HomeArgumentSummarySchema = z.object({
  id: z.string(),
  argumentText: z.string(),
  descendantCount: z.number(),
  createdAt: z.coerce.string(),
  isInitial: z.boolean(),
  subtopicId: z.number(),
  topicId: z.number(),
  topicTitle: z.string(),
  subtopicTitle: z.string(),
});
export type HomeArgumentSummary = z.infer<typeof HomeArgumentSummarySchema>;

export const PlatformStatsSchema = z.object({
  registeredUsers: z.number().int().nonnegative(),
  totalArguments: z.number().int().nonnegative(),
  argumentsIn: z.number().int().nonnegative(),
  argumentsOut: z.number().int().nonnegative(),
  argumentsUndecided: z.number().int().nonnegative(),
});
export type PlatformStats = z.infer<typeof PlatformStatsSchema>;

export const HomeArgumentListsSchema = z.object({
  platformStats: PlatformStatsSchema,
  topInitialByDescendants: z.array(HomeArgumentSummarySchema),
  recent: z.array(HomeArgumentSummarySchema),
});
export type HomeArgumentLists = z.infer<typeof HomeArgumentListsSchema>;

// ---------------------------------------------------------------------------
// LLM-assisted helpers
// ---------------------------------------------------------------------------

export const RenderArgumentResponseSchema = z.object({
  prose: z.string(),
});
export type RenderArgumentResponse = z.infer<typeof RenderArgumentResponseSchema>;

const ArgumentTextGenerationBaseSchema = z.object({
  schemeId: z.string().min(1),
  variables: z.array(ArgumentVariableValueSchema),
});

export const GenerateInitialArgumentTextRequestSchema = ArgumentTextGenerationBaseSchema.extend({
  kind: z.literal("initial"),
  subtopicId: z.number().int().positive(),
});

export const GenerateCounterArgumentTextRequestSchema = ArgumentTextGenerationBaseSchema.extend({
  kind: z.literal("counter"),
  parentArgumentId: z.string().min(1),
  selectedCqId: z.string().min(1),
});

export const GenerateArgumentTextRequestSchema = z.discriminatedUnion("kind", [
  GenerateInitialArgumentTextRequestSchema,
  GenerateCounterArgumentTextRequestSchema,
]);

export const GeneratedTextOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
});

export const GenerateArgumentTextResponseSchema = z.object({
  previewToken: z.string(),
  options: z.array(GeneratedTextOptionSchema).length(3),
  fallback: z.string(),
});

export const ReleaseArgumentTextPreviewRequestSchema = z.object({
  previewToken: z.string().min(1),
});

export const ModerationViolationSchema = z.object({
  variableId: z.string(),
  reason: z.string(),
});

export const ModerationFailedResponseSchema = z.object({
  error: z.literal("moderation_failed"),
  violations: z.array(ModerationViolationSchema),
});

export type ModerationViolation = z.infer<typeof ModerationViolationSchema>;
export type ModerationFailedResponse = z.infer<typeof ModerationFailedResponseSchema>;

export type GenerateInitialArgumentTextRequest = z.infer<
  typeof GenerateInitialArgumentTextRequestSchema
>;
export type GenerateCounterArgumentTextRequest = z.infer<
  typeof GenerateCounterArgumentTextRequestSchema
>;
export type GenerateArgumentTextRequest = z.infer<typeof GenerateArgumentTextRequestSchema>;
export type GenerateArgumentTextResponse = z.infer<typeof GenerateArgumentTextResponseSchema>;
export type GeneratedTextOption = z.infer<typeof GeneratedTextOptionSchema>;
export type ReleaseArgumentTextPreviewRequest = z.infer<
  typeof ReleaseArgumentTextPreviewRequestSchema
>;

export const SuggestArgumentRequestSchema = z.object({
  text: z.string().min(10).max(500),
});

export const SchemeSuggestionSchema = z.object({
  schemeId: z.string(),
  schemeName: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
  prefillVariables: z.record(z.string(), z.string()),
});

export const SuggestArgumentResponseSchema = z.object({
  suggestions: z.array(SchemeSuggestionSchema),
});

export type SuggestArgumentRequest = z.infer<typeof SuggestArgumentRequestSchema>;
export type SchemeSuggestion = z.infer<typeof SchemeSuggestionSchema>;
export type SuggestArgumentResponse = z.infer<typeof SuggestArgumentResponseSchema>;

export const PathDialogueRequestSchema = z.object({
  startArgumentId: z.string(),
  endArgumentId: z.string(),
});

export const PathDialogueResponseSchema = z.object({
  dialogue: z.string(),
  turnCount: z.number(),
});

export type PathDialogueRequest = z.infer<typeof PathDialogueRequestSchema>;
export type PathDialogueResponse = z.infer<typeof PathDialogueResponseSchema>;
