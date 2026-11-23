import type { ArgumentStatus } from "@inch/types";
import {
  evaluateBranch,
  evaluateGroundedSemantics,
  type EvaluationGraph,
  type EvaluationNode,
} from "../modules/argumentation/evaluation.js";

/** p-th percentile of sorted finite samples (linear interpolation on rank). */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const s = [...samples].sort((a, b) => a - b);
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return s[lo];
  const w = rank - lo;
  return s[lo] * (1 - w) + s[hi] * w;
}

/** Linear debate chain: id[0] root (initial); id[i] attacks id[i-1] via childIds. */
export function buildLinearChainGraph(nodeCount: number): {
  graph: EvaluationGraph;
  leafId: string;
  rootId: string;
} {
  if (nodeCount < 2) {
    throw new Error("nodeCount must be at least 2 for a chain benchmark");
  }
  const graph: EvaluationGraph = new Map();
  const ids = Array.from({ length: nodeCount }, (_, i) => `nfr_${i}`);

  for (let i = 0; i < nodeCount; i += 1) {
    const parentId = i === 0 ? null : ids[i - 1];
    const childIds = i < nodeCount - 1 ? [ids[i + 1]] : [];
    const node: EvaluationNode = {
      id: ids[i],
      status: "UNDECIDED",
      parentId,
      childIds,
    };
    graph.set(ids[i], node);
  }

  return { graph, leafId: ids[nodeCount - 1], rootId: ids[0] };
}

export function timeFullGraphMs(graph: EvaluationGraph): number {
  const clone = cloneGraph(graph);
  const t0 = performance.now();
  evaluateGroundedSemantics(clone);
  return performance.now() - t0;
}

export function timeBranchMs(graph: EvaluationGraph, leafId: string): number {
  const clone = cloneGraph(graph);
  const t0 = performance.now();
  evaluateBranch(clone, leafId);
  return performance.now() - t0;
}

function cloneGraph(graph: EvaluationGraph): EvaluationGraph {
  const next: EvaluationGraph = new Map();
  for (const [id, node] of graph.entries()) {
    next.set(id, {
      id: node.id,
      status: node.status as ArgumentStatus,
      parentId: node.parentId,
      childIds: [...node.childIds],
    });
  }
  return next;
}

export interface FullGraphBenchRow {
  nodeCount: number;
  iterations: number;
  p50Ms: number;
  p95Ms: number;
  samplesMs: number[];
}

export interface BranchBenchRow {
  pathNodes: number;
  iterations: number;
  p50Ms: number;
  p95Ms: number;
  samplesMs: number[];
}

export interface MicrobenchResult {
  fullGraph: FullGraphBenchRow[];
  branch: BranchBenchRow[];
  nodeVersion: string;
  platform: string;
}

/**
 * In-process timings for grounded evaluation (no HTTP/DB/Redis).
 * Warms each size once before collecting samples.
 */
export function runNfrMicrobench(options?: {
  fullGraphSizes?: number[];
  branchPathNodes?: number[];
  iterationsPerCase?: number;
}): MicrobenchResult {
  const fullGraphSizes = options?.fullGraphSizes ?? [100, 200, 300, 500];
  const branchPathNodes = options?.branchPathNodes ?? [5, 10, 15, 20, 25];
  const iterations = options?.iterationsPerCase ?? 50;

  const fullGraph: FullGraphBenchRow[] = [];
  for (const nodeCount of fullGraphSizes) {
    const { graph } = buildLinearChainGraph(nodeCount);
    timeFullGraphMs(graph);
    const samplesMs: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      samplesMs.push(timeFullGraphMs(graph));
    }
    fullGraph.push({
      nodeCount,
      iterations,
      p50Ms: percentile(samplesMs, 50),
      p95Ms: percentile(samplesMs, 95),
      samplesMs,
    });
  }

  const branch: BranchBenchRow[] = [];
  for (const pathNodes of branchPathNodes) {
    const { graph, leafId } = buildLinearChainGraph(pathNodes);
    timeBranchMs(graph, leafId);
    const samplesMs: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      samplesMs.push(timeBranchMs(graph, leafId));
    }
    branch.push({
      pathNodes,
      iterations,
      p50Ms: percentile(samplesMs, 50),
      p95Ms: percentile(samplesMs, 95),
      samplesMs,
    });
  }

  return {
    fullGraph,
    branch,
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
  };
}
