import type { FastifyInstance } from "fastify";
import { search } from "./search.service.js";

/**
 * Registers the search endpoint that exposes cross-entity full-text lookup.
 *
 * @param fastify Fastify application instance used to attach the route.
 * @returns Resolves when the plugin registration completes.
 */
export async function searchRoutes(fastify: FastifyInstance) {
  // GET /search?q=term&page=1&limit=10
  fastify.get("/search", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const q = query.q ?? "";
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 10)));

    if (!q.trim()) {
      return reply.send({
        query: q,
        results: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
    }

    try {
      const { results, total } = await search(q, page, limit);
      return reply.send({
        query: q,
        results,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal error";
      return reply.status(500).send({ error: message });
    }
  });
}
