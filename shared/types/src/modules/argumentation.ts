import { z } from "zod";

/** Argument status under grounded semantics */
export const ArgumentStatusSchema = z.enum(["IN", "OUT", "UNDECIDED"]);
export type ArgumentStatus = z.infer<typeof ArgumentStatusSchema>;

/** WebSocket payload for status updates (subtopic room) */
export const StatusUpdatePayloadSchema = z.object({
  subtopicId: z.number(),
  updates: z.array(
    z.object({
      id: z.string(),
      status: ArgumentStatusSchema,
    }),
  ),
});
export type StatusUpdatePayload = z.infer<typeof StatusUpdatePayloadSchema>;

/** WebSocket payload emitted when a new argument is inserted into a subtopic graph. */
export const ArgumentCreatedPayloadSchema = z.object({
  subtopicId: z.number(),
  argumentId: z.string(),
  parentId: z.string().nullable(),
});
export type ArgumentCreatedPayload = z.infer<typeof ArgumentCreatedPayloadSchema>;

export const SchemeVariableTypeSchema = z.enum(["string", "entity", "claim"]);

export const SchemeVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  placeholder: z.string(),
  required: z.boolean(),
  type: SchemeVariableTypeSchema,
});

export const CriticalQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  description: z.string(),
  validResponseSchemeIds: z.array(z.string()),
});

export const SchemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  conclusion: z.string(),
  variables: z.array(SchemeVariableSchema),
  criticalQuestions: z.array(CriticalQuestionSchema),
});

export const SchemesRegistrySchema = z.object({
  version: z.string(),
  schemes: z.array(SchemeSchema),
});

export type SchemeVariableType = z.infer<typeof SchemeVariableTypeSchema>;
export type SchemeVariable = z.infer<typeof SchemeVariableSchema>;
export type CriticalQuestion = z.infer<typeof CriticalQuestionSchema>;
export type Scheme = z.infer<typeof SchemeSchema>;
export type SchemesRegistry = z.infer<typeof SchemesRegistrySchema>;

export function loadAndValidateSchemes(json: unknown): SchemesRegistry {
  const result = SchemesRegistrySchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `schemes.json failed validation:\n${result.error.issues
        .map((i) => `  [${i.path.join(".")}] ${i.message}`)
        .join("\n")}`,
    );
  }
  return result.data;
}
