import type { ArgumentStatus, StatusUpdatePayload } from "@inch/types";
import { Worker } from "bullmq";
import type { EvaluationJobData } from "./evaluationQueue.js";
import { getRedisClient } from "../cache/redis.js";
import { prisma } from "../db/prisma.js";
import {
  evaluateBranch,
  type EvaluationGraph,
  type EvaluationNode,
} from "../modules/argumentation/evaluation.js";
import { getSubtopicRoom, emitToRoom } from "../websocket/ws.js";

/**
 * Starts the BullMQ worker that recalculates grounded statuses after submissions.
 *
 * Side effects:
 * - Reads and writes argument statuses in PostgreSQL.
 * - Invalidates Redis caches for affected arguments/subtopic graphs.
 * - Emits websocket `STATUS_UPDATE` events to subscribed clients.
 *
 * @returns BullMQ worker instance.
 * @throws {Error} Thrown when `REDIS_URL` is missing.
 */
export function startEvaluationWorker() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
  }
  const url = new URL(redisUrl);

  const worker = new Worker<EvaluationJobData>(
    "argument-evaluation",
    async (job) => {
      const { subtopicId, newArgumentId } = job.data;

      const branch = await loadBranch(newArgumentId);
      if (branch.size === 0) {
        console.warn(`[evaluation] Branch empty for arg ${newArgumentId}`);
        return;
      }

      const changes = evaluateBranch(branch, newArgumentId);

      if (changes.size === 0) {
        console.log(`[evaluation] No status changes for arg ${newArgumentId}`);
        return;
      }

      await prisma.$transaction(
        [...changes.entries()].map(([id, status]) =>
          prisma.argument.update({
            where: { id },
            data: { status: status as ArgumentStatus },
          }),
        ),
      );

      const redis = getRedisClient();
      if (redis) {
        await redis.del(`subtopic:${subtopicId}:arguments`).catch(() => {});

        const argumentCacheKeys = [...changes.keys()].map((id) => `argument:${id}`);
        if (argumentCacheKeys.length > 0) {
          await Promise.all(argumentCacheKeys.map((key) => redis.del(key).catch(() => 0)));
        }
      }

      const payload: StatusUpdatePayload = {
        subtopicId,
        updates: [...changes.entries()].map(([id, status]) => ({
          id,
          status,
        })),
      };

      emitToRoom(getSubtopicRoom(subtopicId), "STATUS_UPDATE", payload);

      console.log(`[evaluation] Updated ${changes.size} argument(s) in subtopic ${subtopicId}`);
    },
    {
      // Only host and port are taken from REDIS_URL. Credentials, database index
      // and TLS (rediss://) are not passed to the worker connection.
      connection: {
        host: url.hostname,
        port: Number(url.port) || 6379,
        maxRetriesPerRequest: null,
      },
      // Evaluations must not overlap. Each job reads the branch's current
      // statuses, relabels it and writes the result, so two concurrent jobs on
      // the same graph could each start from stale statuses and overwrite each
      // other's grounded labelling. Jobs share one queue and are keyed only per
      // new argument (jobId subtopic:<id>:<argumentId>), with no per-subtopic
      // lock, so concurrency 1 serialises ALL evaluations, across every subtopic.
      // That trades cross-graph parallelism for simplicity and correctness. The
      // guarantee holds per worker: running several backend processes would run
      // one job per process at a time.
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[evaluation] Job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Loads the branch from the new argument up to the root initial argument,
 * plus every **direct** attacker (child) of any node on that path.
 *
 * Sibling attackers not on the ancestor path must be present so parent status
 * considers every attacker (e.g. one OUT + one UNDECIDED → parent UNDECIDED).
 */
async function loadBranch(newArgumentId: string): Promise<EvaluationGraph> {
  const graph: EvaluationGraph = new Map();
  let currentId: string | null = newArgumentId;

  while (currentId !== null) {
    const arg: {
      id: string;
      status: unknown;
      parentId: string | null;
      childIds: string[];
      isInitial: boolean;
    } | null = await prisma.argument.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        status: true,
        parentId: true,
        childIds: true,
        isInitial: true,
      },
    });

    if (!arg) break;

    const node: EvaluationNode = {
      id: arg.id,
      status: arg.status as ArgumentStatus,
      parentId: arg.parentId,
      childIds: arg.childIds,
    };

    graph.set(arg.id, node);

    // Stop at the initial argument (root of this branch)
    if (arg.isInitial) break;
    currentId = arg.parentId;
  }

  await loadMissingDirectChildren(graph);

  return graph;
}

/** Fetches attacker nodes that are not yet in `graph` (typically off-path siblings). */
async function loadMissingDirectChildren(graph: EvaluationGraph): Promise<void> {
  const missing = new Set<string>();
  for (const node of graph.values()) {
    for (const cid of node.childIds) {
      if (!graph.has(cid)) missing.add(cid);
    }
  }
  if (missing.size === 0) return;

  const rows = await prisma.argument.findMany({
    where: { id: { in: [...missing] } },
    select: {
      id: true,
      status: true,
      parentId: true,
      childIds: true,
    },
  });

  for (const arg of rows) {
    if (graph.has(arg.id)) continue;
    graph.set(arg.id, {
      id: arg.id,
      status: arg.status as ArgumentStatus,
      parentId: arg.parentId,
      childIds: arg.childIds,
    });
  }
}
