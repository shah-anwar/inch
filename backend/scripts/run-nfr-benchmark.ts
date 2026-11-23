/**
 * Writes in-process NFR microbenchmark results to experiments/results/nfr/summary.json
 * (repo root). Run from backend: npm run bench:nfr
 *
 * What is timed: only the pure evaluation functions, on synthetic linear chains
 * held in memory. There is no database, Redis, HTTP or WebSocket in the loop.
 *   - fullGraph: `evaluateGroundedSemantics` over the whole chain, starting with
 *     every node UNDECIDED. Nodes are visited root first, so the loop needs about
 *     one pass per level; a chain is close to the worst case for this function.
 *   - branch: `evaluateBranch` from the leaf to the root, the path the worker
 *     actually evaluates after a submission.
 * Each size is warmed up once, then sampled 50 times; p50/p95 are reported in ms.
 *
 * This overwrites summary.json and drops any `pipeline` section. Re-add the
 * output of nfr-pipeline-bench.ts by hand if both are needed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNfrMicrobench } from "../src/benchmarks/nfrMicrobench.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const outDir = join(repoRoot, "experiments/results/nfr");
const outFile = join(outDir, "summary.json");

const result = runNfrMicrobench({
  fullGraphSizes: [100, 200, 300, 500],
  branchPathNodes: [5, 10, 15, 20, 25],
  iterationsPerCase: 50,
});

const payload = {
  generatedAt: new Date().toISOString(),
  kind: "nfr_microbench_v1",
  microbench: {
    fullGraph: result.fullGraph.map((row) => ({
      nodeCount: row.nodeCount,
      iterations: row.iterations,
      p50Ms: round4(row.p50Ms),
      p95Ms: round4(row.p95Ms),
    })),
    branch: result.branch.map((row) => ({
      pathNodes: row.pathNodes,
      iterations: row.iterations,
      p50Ms: round4(row.p50Ms),
      p95Ms: round4(row.p95Ms),
    })),
    environment: {
      nodeVersion: result.nodeVersion,
      platform: result.platform,
    },
  },
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${outFile}`);
console.log(JSON.stringify(payload, null, 2));

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
