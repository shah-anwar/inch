import { z } from "zod";

// --- Create User ---
export const CreateUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});
export const CreateUserResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  createdAt: z.coerce.date(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

// --- Login ---
export const LoginUserSchema = z.object({
  loginString: z.string().min(3),
  password: z.string().min(8),
});
export const LoginUserResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
});
export type LoginUserInput = z.infer<typeof LoginUserSchema>;
export type LoginUserResponse = z.infer<typeof LoginUserResponseSchema>;

export const RefreshSessionBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export const RefreshSessionResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
});
export type RefreshSessionBody = z.infer<typeof RefreshSessionBodySchema>;
export type RefreshSessionResponse = z.infer<typeof RefreshSessionResponseSchema>;

// --- Get Me ---
export const GetMeResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  createdAt: z.coerce.date(),
  isAdmin: z.boolean(),
});
export type GetMeResponse = z.infer<typeof GetMeResponseSchema>;
