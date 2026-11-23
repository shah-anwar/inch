import { z } from "zod";

const SchemeIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, {
  message: "Scheme ID must be lowercase letters, numbers, and underscores only",
});

export const AdminCriticalQuestionSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  text: z.string(),
  description: z.string(),
  validResponseSchemeIds: z.array(z.string()),
});

export const AdminSchemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  conclusion: z.string(),
  variables: z.unknown(),
  createdAt: z.string(),
  criticalQuestions: z.array(AdminCriticalQuestionSchema),
});

export const CreateSchemeSchema = z.object({
  id: SchemeIdSchema,
  name: z.string().min(3),
  description: z.string().min(10),
  conclusion: z.string().min(5),
  variables: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      placeholder: z.string(),
      type: z.string(),
      required: z.boolean(),
    }),
  ),
});

export const UpdateSchemeSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  conclusion: z.string().min(5).optional(),
  variables: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        placeholder: z.string(),
        type: z.string(),
        required: z.boolean(),
      }),
    )
    .optional(),
});

export const CreateCriticalQuestionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  text: z.string().min(5),
  description: z.string().min(10),
  validResponseSchemeIds: z.array(z.string()),
});

export const UpdateCriticalQuestionSchema = z
  .object({
    validResponseSchemeIds: z.array(z.string()),
  })
  .strict();

export const ActiveSchemeSchema = z.object({
  schemeId: z.string(),
});

export const ActiveSchemesResponseSchema = z.object({
  activeSchemeIds: z.array(z.string()),
});

export const SetActiveSchemesSchema = z.object({
  activeSchemeIds: z.array(z.string()),
});

export const PromoteUserToAdminSchema = z.object({
  username: z.string().min(3),
});

export const PromoteUserToAdminResponseSchema = z.object({
  username: z.string(),
  status: z.enum(["already_admin", "promoted", "not_found"]),
});

export type AdminScheme = z.infer<typeof AdminSchemeSchema>;
export type AdminCriticalQuestion = z.infer<typeof AdminCriticalQuestionSchema>;
export type CreateScheme = z.infer<typeof CreateSchemeSchema>;
export type UpdateScheme = z.infer<typeof UpdateSchemeSchema>;
export type CreateCriticalQuestion = z.infer<typeof CreateCriticalQuestionSchema>;
export type UpdateCriticalQuestion = z.infer<typeof UpdateCriticalQuestionSchema>;
export type ActiveScheme = z.infer<typeof ActiveSchemeSchema>;
export type ActiveSchemesResponse = z.infer<typeof ActiveSchemesResponseSchema>;
export type SetActiveSchemes = z.infer<typeof SetActiveSchemesSchema>;
export type PromoteUserToAdmin = z.infer<typeof PromoteUserToAdminSchema>;
export type PromoteUserToAdminResponse = z.infer<typeof PromoteUserToAdminResponseSchema>;
