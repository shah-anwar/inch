import { describe, it, expect } from "@jest/globals";
import {
  evaluateGroundedSemantics,
  evaluateBranch,
  type EvaluationGraph,
  type EvaluationNode,
} from "../../../src/modules/argumentation/evaluation.js";

function node(partial: Omit<EvaluationNode, "childIds"> & { childIds?: string[] }): EvaluationNode {
  return {
    childIds: partial.childIds ?? [],
    id: partial.id,
    status: partial.status,
    parentId: partial.parentId,
  };
}

describe("evaluation", () => {
  describe("evaluateGroundedSemantics", () => {
    it("returns an empty map when nothing changes", () => {
      const graph: EvaluationGraph = new Map([
        ["a", node({ id: "a", status: "IN", parentId: null })],
      ]);

      const changes = evaluateGroundedSemantics(graph);

      expect(changes.size).toBe(0);
      expect(graph.get("a")!.status).toBe("IN");
    });

    it("propagates status until a fixed point across multiple passes", () => {
      const graph: EvaluationGraph = new Map([
        [
          "root",
          node({
            id: "root",
            status: "UNDECIDED",
            parentId: null,
            childIds: ["mid"],
          }),
        ],
        [
          "mid",
          node({
            id: "mid",
            status: "UNDECIDED",
            parentId: "root",
            childIds: ["leaf"],
          }),
        ],
        [
          "leaf",
          node({
            id: "leaf",
            status: "IN",
            parentId: "mid",
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateGroundedSemantics(graph);

      expect(changes.get("mid")).toBe("OUT");
      expect(changes.get("root")).toBe("IN");
      expect(graph.get("leaf")!.status).toBe("IN");
      expect(graph.get("mid")!.status).toBe("OUT");
      expect(graph.get("root")!.status).toBe("IN");
    });

    it("marks a parent OUT when any child is IN", () => {
      const graph: EvaluationGraph = new Map([
        [
          "p",
          node({
            id: "p",
            status: "IN",
            parentId: null,
            childIds: ["c"],
          }),
        ],
        [
          "c",
          node({
            id: "c",
            status: "IN",
            parentId: "p",
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateGroundedSemantics(graph);

      expect(changes.get("p")).toBe("OUT");
    });

    it("marks a parent IN when every child is OUT (each child has an IN attacker)", () => {
      const graph: EvaluationGraph = new Map([
        [
          "p",
          node({
            id: "p",
            status: "UNDECIDED",
            parentId: null,
            childIds: ["c1", "c2"],
          }),
        ],
        [
          "c1",
          node({
            id: "c1",
            status: "OUT",
            parentId: "p",
            childIds: ["a1"],
          }),
        ],
        [
          "c2",
          node({
            id: "c2",
            status: "OUT",
            parentId: "p",
            childIds: ["a2"],
          }),
        ],
        [
          "a1",
          node({
            id: "a1",
            status: "IN",
            parentId: "c1",
            childIds: [],
          }),
        ],
        [
          "a2",
          node({
            id: "a2",
            status: "IN",
            parentId: "c2",
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateGroundedSemantics(graph);

      expect(changes.get("p")).toBe("IN");
    });

    it("marks a parent UNDECIDED when a listed child is absent from the graph", () => {
      const graph: EvaluationGraph = new Map([
        [
          "p",
          node({
            id: "p",
            status: "IN",
            parentId: null,
            childIds: ["ghost"],
          }),
        ],
      ]);

      const changes = evaluateGroundedSemantics(graph);

      expect(changes.get("p")).toBe("UNDECIDED");
    });
  });

  describe("evaluateBranch", () => {
    it("skips evaluation when a path id is absent from the graph", () => {
      const graph: EvaluationGraph = new Map([
        [
          "a",
          node({
            id: "a",
            status: "IN",
            parentId: null,
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateBranch(graph, "ghost");

      expect(changes.size).toBe(0);
    });

    it("stops the upward walk when the parent id is not in the graph", () => {
      const graph: EvaluationGraph = new Map([
        [
          "leaf",
          node({
            id: "leaf",
            status: "IN",
            parentId: "missing",
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateBranch(graph, "leaf");

      expect(changes.size).toBe(0);
      expect(graph.get("leaf")!.status).toBe("IN");
    });

    it("updates statuses bottom-up along the ancestor chain", () => {
      const graph: EvaluationGraph = new Map([
        [
          "root",
          node({
            id: "root",
            status: "UNDECIDED",
            parentId: null,
            childIds: ["mid"],
          }),
        ],
        [
          "mid",
          node({
            id: "mid",
            status: "UNDECIDED",
            parentId: "root",
            childIds: ["leaf"],
          }),
        ],
        [
          "leaf",
          node({
            id: "leaf",
            status: "IN",
            parentId: "mid",
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateBranch(graph, "leaf");

      expect(changes.get("mid")).toBe("OUT");
      expect(changes.get("root")).toBe("IN");
      expect(graph.get("leaf")!.status).toBe("IN");
    });

    it("records no change when computed status matches the current status", () => {
      const graph: EvaluationGraph = new Map([
        [
          "solo",
          node({
            id: "solo",
            status: "IN",
            parentId: null,
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateBranch(graph, "solo");

      expect(changes.size).toBe(0);
    });

    it("uses the UNDECIDED rule when one child is OUT and another off-path child is UNDECIDED", () => {
      const graph: EvaluationGraph = new Map([
        [
          "side",
          node({
            id: "side",
            status: "UNDECIDED",
            parentId: null,
            childIds: [],
          }),
        ],
        [
          "root",
          node({
            id: "root",
            status: "IN",
            parentId: null,
            childIds: ["mid", "side"],
          }),
        ],
        [
          "mid",
          node({
            id: "mid",
            status: "OUT",
            parentId: "root",
            childIds: ["leaf"],
          }),
        ],
        [
          "leaf",
          node({
            id: "leaf",
            status: "IN",
            parentId: "mid",
            childIds: [],
          }),
        ],
      ]);

      const changes = evaluateBranch(graph, "leaf");

      expect(changes.get("root")).toBe("UNDECIDED");
    });
  });
});
