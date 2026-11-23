import { User } from "@inch/types";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createUser,
  loginUser,
  refreshAccessToken,
  revokeRefreshToken,
  getUserArguments,
  changeUserPassword,
} from "./user.service.js";
import { getAuthenticatedUser } from "../../utils/auth.js";
import { validate, ValidationError } from "../../utils/validate.js";

/**
 * Registers authentication and user profile routes.
 *
 * Endpoints:
 * - `GET /me` current authenticated user
 * - `GET /me/arguments` arguments submitted by authenticated user
 * - `POST /users` user registration
 * - `POST /login` credential authentication
 * - `POST /auth/refresh` new access token from refresh token
 * - `POST /auth/logout` revoke current refresh session
 *
 * @param app Fastify instance to attach routes to.
 * @returns Promise resolved after registration.
 */
export default async function userRoutes(app: FastifyInstance) {
  const UpdatePasswordSchema = z
    .object({
      currentPassword: z.string().min(8),
      newPassword: z.string().min(8),
      confirmNewPassword: z.string().min(8),
    })
    .refine((v) => v.newPassword === v.confirmNewPassword, {
      message: "New passwords do not match",
      path: ["confirmNewPassword"],
    });

  app.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;
    return reply.code(200).send(user);
  });

  app.get("/me/arguments", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;
    const arguments_ = await getUserArguments(user.id);
    return reply.code(200).send(arguments_);
  });

  app.post("/me/password", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const body = UpdatePasswordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues });
    }

    try {
      await changeUserPassword(user.id, body.data.currentPassword, body.data.newPassword);
      return reply.code(204).send();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      if (message === "Current password is incorrect") {
        return reply.status(400).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  app.post("/users", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = validate(User.CreateUserSchema, request.body);
      const user = await createUser(body);
      return reply.code(201).send({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      });
    } catch (e) {
      if (e instanceof ValidationError) {
        return reply.code(400).send({ error: e.issues });
      }
      throw e;
    }
  });

  app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = validate(User.LoginUserSchema, request.body);
      const tokens = await loginUser(body);
      return reply.code(200).send(tokens);
    } catch (e) {
      if (e instanceof ValidationError) {
        return reply.code(400).send({ error: e.issues });
      }
      return reply.code(401).send({ error: "Invalid credentials" });
    }
  });

  app.post("/auth/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = validate(User.RefreshSessionBodySchema, request.body);
      const tokens = await refreshAccessToken(body.refreshToken);
      return reply.code(200).send(tokens);
    } catch (e) {
      if (e instanceof ValidationError) {
        return reply.code(400).send({ error: e.issues });
      }
      return reply.code(401).send({ error: "Invalid or expired session" });
    }
  });

  app.post("/auth/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = validate(User.RefreshSessionBodySchema, request.body);
      await revokeRefreshToken(body.refreshToken);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof ValidationError) {
        return reply.code(400).send({ error: e.issues });
      }
      throw e;
    }
  });
}
