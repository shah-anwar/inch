/**
 * Measures enqueue→persisted-status latency for the evaluation worker (BullMQ + Prisma),
 * without HTTP or WebSocket. Requires DATABASE_URL, REDIS_URL, seeded data, and a user.
 *
 * What is timed, per iteration: the clock starts just before `evaluationQueue.add()`
 * and stops when a poll first sees the new counter-argument's row leave UNDECIDED.
 * That covers the Redis round trip, worker pickup, loading the branch, running
 * `evaluateBranch`, and the Prisma transaction that writes the new statuses.
 * Creating the argument row happens before the clock starts and is excluded. The
 * row is polled every 5 ms, so each sample can overstate the latency by up to
 * about 5 ms plus one query. Each iteration adds a new reply to the same seeded
 * parent, so the branch is short and the parent's attacker list grows over the run.
 *
 * Run: cd backend && npx tsx scripts/nfr-pipeline-bench.ts
 */
import "dotenv/config";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/db/prisma.js";
import { createCounterArgument } from "../src/modules/argumentation/argument.repository.js";
import { evaluationQueue } from "../src/queue/evaluationQueue.js";
import { startEvaluationWorker } from "../src/queue/evaluationWorker.js";
import { percentile } from "../src/benchmarks/nfrMicrobench.js";

const ITERATIONS = 30;

async function main(): Promise<void> {
  let worker: ReturnType<typeof startEvaluationWorker> | null = null;
  try {
    worker = startEvaluationWorker();
  } catch (e) {
    console.error(
      "Cannot start evaluation worker (REDIS_URL missing?).",
      e instanceof Error ? e.message : e,
    );
    process.exit(1);
  }

  const seedUser = await prisma.user.findUnique({
    where: { email: "seed@inch.dev" },
  });
  if (!seedUser) {
    console.error("Seed user seed@inch.dev not found — run backend seed first.");
    await worker.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const parent = await prisma.argument.findFirst({
    where: { isInitial: true, schemeId: "expert_opinion" },
    orderBy: { createdAt: "asc" },
    select: { id: true, subtopicId: true },
  });
  if (!parent) {
    console.error("No initial expert_opinion argument found — run backend seed.");
    await worker.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const samplesMs: number[] = [];

  for (let i = 0; i < ITERATIONS; i += 1) {
    const runId = `${Date.now()}_${i}`;
    const argument = await createCounterArgument(
      {
        schemeId: "sign",
        selectedCqId: "cq_eo_1",
        parentArgumentId: parent.id,
        variables: [
          {
            variableId: "sign",
            value: `NFR pipeline benchmark evidence line ${runId}`,
          },
          {
            variableId: "conclusion_b",
            value: "synthetic counterclaim for worker timing",
          },
          {
            variableId: "sign_relationship",
            value: "benchmark-only structural relationship text",
          },
        ],
        argumentText: `Benchmark counter ${runId}.`,
      },
      seedUser.id,
    );

    const t0 = performance.now();
    await evaluationQueue.add(
      `eval:${argument.id}`,
      { subtopicId: argument.subtopicId, newArgumentId: argument.id },
      {
        jobId: `bench-${parent.subtopicId}-${argument.id}-${runId}`,
      },
    );

    const deadline = t0 + 30_000;
    let observedMs = -1;
    while (performance.now() < deadline) {
      const row = await prisma.argument.findUnique({
        where: { id: argument.id },
        select: { status: true },
      });
      if (row && row.status !== "UNDECIDED") {
        observedMs = performance.now() - t0;
        break;
      }
      await new Promise<void>((r) => setTimeout(r, 5));
    }

    if (observedMs < 0) {
      console.error(`Timeout waiting for evaluation (iteration ${i})`);
      await worker.close();
      await prisma.$disconnect();
      process.exit(1);
    }
    samplesMs.push(observedMs);
  }

  await worker.close();

  const p50 = percentile(samplesMs, 50);
  const p95 = percentile(samplesMs, 95);

  console.log(
    JSON.stringify(
      {
        kind: "nfr_pipeline_bench_v1",
        iterations: ITERATIONS,
        p50Ms: round4(p50),
        p95Ms: round4(p95),
        samplesMs: samplesMs.map((x) => round4(x)),
        note: "Time from evaluationQueue.add() until the new argument row leaves UNDECIDED (worker + DB). Not HTTP or WebSocket latency.",
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
