import "dotenv/config";
import { prisma } from "@db/prisma.js";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { argumentRoutes } from "./modules/argumentation/argument.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
import { topicRoutes } from "./modules/topic/topic.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import { startEvaluationWorker } from "./queue/evaluationWorker.js";
import { registerWebSocketPlugin } from "./websocket/ws.js";

/**
 * Builds and configures the Fastify application with all HTTP and WS plugins.
 *
 * @returns Configured Fastify instance ready to listen.
 */
async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true, // Allow all origins (for dev); restrict in prod
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(userRoutes);
  await app.register(topicRoutes);
  await app.register(argumentRoutes);
  await app.register(searchRoutes);
  await app.register(adminRoutes, { prefix: "/admin" });

  // Register WebSocket plugin
  await registerWebSocketPlugin(app);

  return app;
}

/**
 * Boots the backend server and optional evaluation worker, then handles graceful shutdown.
 *
 * Side effects:
 * - Binds HTTP listener on port 3000.
 * - Starts BullMQ worker when Redis is configured.
 * - Registers SIGINT cleanup for worker and Prisma.
 */
async function start() {
  const app = await buildServer();

  if (!process.env.JWT_SECRET) {
    app.log.warn(
      "JWT_SECRET is not set — login and authenticated routes (e.g. POST /arguments/counter) will return 401. Set JWT_SECRET in backend/.env.",
    );
  }

  let evaluationWorker: Awaited<ReturnType<typeof startEvaluationWorker>> | null = null;
  try {
    evaluationWorker = startEvaluationWorker();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    app.log.warn(
      "Evaluation worker not started: " +
        message +
        " — argument evaluation will not run until Redis is available.",
    );
  }

  const address = await app.listen({ port: 3000 });
  console.log(`inch backend listening at ${address}`);

  process.on("SIGINT", async () => {
    if (evaluationWorker) await evaluationWorker.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

start();
