import { describe, it, expect } from "@jest/globals";
import {
  buildLinearChainGraph,
  percentile,
  runNfrMicrobench,
  timeFullGraphMs,
} from "../../src/benchmarks/nfrMicrobench.js";

describe("nfrMicrobench", () => {
  it("percentile handles ordered samples", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBeCloseTo(3, 5);
    expect(percentile([10, 20, 30], 95)).toBeGreaterThanOrEqual(20);
  });

  it("buildLinearChainGraph produces a leaf path length matching node count", () => {
    const { graph, leafId, rootId } = buildLinearChainGraph(10);
    expect(graph.size).toBe(10);
    let cur: string | null = leafId;
    let steps = 0;
    while (cur !== null) {
      steps += 1;
      cur = graph.get(cur)?.parentId ?? null;
    }
    expect(steps).toBe(10);
    expect(graph.get(rootId)?.parentId).toBeNull();
  });

  it("runNfrMicrobench completes small configuration quickly", () => {
    const r = runNfrMicrobench({
      fullGraphSizes: [20],
      branchPathNodes: [5],
      iterationsPerCase: 3,
    });
    expect(r.fullGraph).toHaveLength(1);
    expect(r.branch).toHaveLength(1);
    expect(r.fullGraph[0].p95Ms).toBeGreaterThan(0);
    expect(r.fullGraph[0].samplesMs).toHaveLength(3);
  });

  it("full-graph timing stays within interactive scale on small graphs", () => {
    const { graph } = buildLinearChainGraph(500);
    const ms = timeFullGraphMs(graph);
    expect(ms).toBeLessThan(5000);
  });
});
