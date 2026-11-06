import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { validate } from "./validate.js";
import { findUserByUsername } from "../modules/user/user.repository.js";

const JWT_SECRET = process.env.JWT_SECRET!;

const JwtPayloadSchema = z.object({
  sub: z.string().min(3),
});

/**
 * Verify JWT from Authorization header and set request.userId.
 * Returns user payload if authenticated; otherwise sends 401 and returns null.
 */
export async function getAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{
  id: number;
  username: string;
  email: string;
  createdAt: Date;
  isAdmin: boolean;
} | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    await reply.code(401).send({ error: "Unauthorised" });
    return null;
  }
  const token = authHeader.split(" ")[1];
  try {
    const raw: unknown = jwt.verify(token, JWT_SECRET);
    const payload = validate(JwtPayloadSchema, raw);
    const user = await findUserByUsername(payload.sub);
    if (!user) {
      await reply.code(401).send({ error: "Unauthorised" });
      return null;
    }
    request.userId = user.id;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      isAdmin: user.isAdmin,
    };
  } catch {
    await reply.code(401).send({ error: "Unauthorised" });
    return null;
  }
}

/**
 * Resolves and verifies the authenticated user has admin privileges.
 *
 * @param request Incoming Fastify request containing the bearer token.
 * @param reply Fastify reply used to send 401/403 failures.
 * @returns The authenticated admin user, or `null` when authentication/authorization fails.
 */
export async function getAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{
  id: number;
  username: string;
  email: string;
  createdAt: Date;
  isAdmin: boolean;
} | null> {
  const user = await getAuthenticatedUser(request, reply);
  if (!user) {
    return null;
  }
  if (!user.isAdmin) {
    await reply.code(403).send({ error: "Admin access required" });
    return null;
  }
  return user;
}
