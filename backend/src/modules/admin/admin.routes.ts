import {
  AdminSchemeSchema,
  AdminCriticalQuestionSchema,
  CreateSchemeSchema,
  UpdateSchemeSchema,
  CreateCriticalQuestionSchema,
  UpdateCriticalQuestionSchema,
  ActiveSchemesResponseSchema,
  SetActiveSchemesSchema,
  PromoteUserToAdminSchema,
  PromoteUserToAdminResponseSchema,
} from "@inch/types";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  listAdminSchemes,
  getAdminSchemeById,
  createAdminScheme,
  updateAdminScheme,
  listAdminCriticalQuestionsForScheme,
  createAdminCriticalQuestion,
  updateAdminCriticalQuestion,
  getAdminCriticalQuestionById,
  findInvalidSchemeIds,
  listActiveSchemeIds,
  setActiveSchemeIds,
  promoteUserToAdmin,
} from "./admin.service.js";
import { getAdminUser } from "../../utils/auth.js";

/**
 * Registers admin-only scheme and critical-question management endpoints.
 *
 * @param app Fastify application instance.
 * @returns Promise resolved when route registration completes.
 */
export async function adminRoutes(app: FastifyInstance) {
  /**
   * Resolves authenticated admin user for route-level guards.
   *
   * @param request Fastify request.
   * @param reply Fastify reply used for auth failures.
   * @returns Admin user or `null` when authentication/authorization fails.
   */
  async function ensureAdmin(request: FastifyRequest, reply: FastifyReply) {
    const user = await getAdminUser(request, reply);
    if (!user) {
      return null;
    }
    return user;
  }

  app.get("/schemes", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const schemes = await listAdminSchemes();
    const parsed = AdminSchemeSchema.array().parse(schemes);
    return reply.status(200).send(parsed);
  });

  app.get("/active-schemes", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const activeSchemes = await listActiveSchemeIds();
    const parsed = ActiveSchemesResponseSchema.parse(activeSchemes);
    return reply.status(200).send(parsed);
  });

  app.put("/active-schemes", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const result = SetActiveSchemesSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    try {
      const updated = await setActiveSchemeIds(result.data);
      const parsed = ActiveSchemesResponseSchema.parse(updated);
      return reply.status(200).send(parsed);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("INVALID_SCHEME_IDS:")) {
        const ids = err.message.replace("INVALID_SCHEME_IDS:", "");
        return reply.status(400).send({
          error: `Invalid activeSchemeIds: ${ids}`,
        });
      }
      const message = err instanceof Error ? err.message : "Internal error";
      return reply.status(500).send({ error: message });
    }
  });

  app.post("/promote-user", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const result = PromoteUserToAdminSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    const response = await promoteUserToAdmin(result.data);
    const parsed = PromoteUserToAdminResponseSchema.parse(response);
    return reply.status(200).send(parsed);
  });

  app.get("/schemes/:schemeId", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const { schemeId } = request.params as { schemeId: string };
    const scheme = await getAdminSchemeById(schemeId);
    if (!scheme) {
      return reply.status(404).send({ error: "Scheme not found" });
    }
    const parsed = AdminSchemeSchema.parse(scheme);
    return reply.status(200).send(parsed);
  });

  app.post("/schemes", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const result = CreateSchemeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    try {
      const scheme = await createAdminScheme(result.data);
      const parsed = AdminSchemeSchema.parse(scheme);
      return reply.status(201).send(parsed);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "SCHEME_ID_EXISTS") {
        return reply.status(409).send({ error: "Scheme ID already exists" });
      }
      const message = err instanceof Error ? err.message : "Internal error";
      return reply.status(500).send({ error: message });
    }
  });

  app.patch("/schemes/:schemeId", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const rawBody = request.body;
    if (rawBody && typeof rawBody === "object" && "id" in (rawBody as Record<string, unknown>)) {
      return reply.status(400).send({ error: "Scheme ID cannot be updated" });
    }

    const result = UpdateSchemeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    const { schemeId } = request.params as { schemeId: string };
    const updated = await updateAdminScheme(schemeId, result.data);
    if (!updated) {
      return reply.status(404).send({ error: "Scheme not found" });
    }

    const parsed = AdminSchemeSchema.parse(updated);
    return reply.status(200).send(parsed);
  });

  app.get("/schemes/:schemeId/critical-questions", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const { schemeId } = request.params as { schemeId: string };
    const cqs = await listAdminCriticalQuestionsForScheme(schemeId);
    if (!cqs) {
      return reply.status(404).send({ error: "Scheme not found" });
    }

    const parsed = AdminCriticalQuestionSchema.array().parse(cqs);
    return reply.status(200).send(parsed);
  });

  app.post("/schemes/:schemeId/critical-questions", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const result = CreateCriticalQuestionSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    const invalidIds = await findInvalidSchemeIds(result.data.validResponseSchemeIds);
    if (invalidIds.length > 0) {
      return reply.status(400).send({
        error: `Invalid validResponseSchemeIds: ${invalidIds.join(", ")}`,
      });
    }

    const { schemeId } = request.params as { schemeId: string };

    try {
      const cq = await createAdminCriticalQuestion(schemeId, result.data);
      const parsed = AdminCriticalQuestionSchema.parse(cq);
      return reply.status(201).send(parsed);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "SCHEME_NOT_FOUND") {
          return reply.status(404).send({ error: "Scheme not found" });
        }
        if (err.message === "CQ_ID_EXISTS") {
          return reply.status(409).send({ error: "Critical question ID already exists" });
        }
      }
      const message = err instanceof Error ? err.message : "Internal error";
      return reply.status(500).send({ error: message });
    }
  });

  app.patch("/critical-questions/:cqId", async (request, reply) => {
    const admin = await ensureAdmin(request, reply);
    if (!admin) return;

    const result = UpdateCriticalQuestionSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    if (result.data.validResponseSchemeIds) {
      const invalidIds = await findInvalidSchemeIds(result.data.validResponseSchemeIds);
      if (invalidIds.length > 0) {
        return reply.status(400).send({
          error: `Invalid validResponseSchemeIds: ${invalidIds.join(", ")}`,
        });
      }
    }

    const { cqId } = request.params as { cqId: string };

    const existing = await getAdminCriticalQuestionById(cqId);
    if (!existing) {
      return reply.status(404).send({ error: "Critical question not found" });
    }

    const updated = await updateAdminCriticalQuestion(cqId, result.data);
    if (!updated) {
      return reply.status(404).send({ error: "Critical question not found" });
    }

    const parsed = AdminCriticalQuestionSchema.parse(updated);
    return reply.status(200).send(parsed);
  });
}
