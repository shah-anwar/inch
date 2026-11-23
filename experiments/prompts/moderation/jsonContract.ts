import { z } from "zod";

/** Model output for scheme variable moderation (all prompt variants use this shape). */
export const moderationResponseSchema = z.object({
  passed: z.boolean(),
  violations: z.array(
    z.object({
      variableId: z.string(),
      reason: z.string(),
    }),
  ),
});

export type ModerationResponse = z.infer<typeof moderationResponseSchema>;

export const MODERATION_JSON_INSTRUCTION = `Return only a single JSON object with this exact shape (no markdown fences, no commentary before or after):
{"passed":boolean,"violations":[{"variableId":string,"reason":string}]}
If passed is true, violations must be []. If passed is false, list each offending variableId with a short reason.`;
