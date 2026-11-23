import type { ArgumentStatus } from "@inch/types";

// Grounded semantics for INCH's attack graphs.
//
// Every counter-argument attacks exactly one parent (`parentId`), so each
// subtopic's graph is a forest of trees with edges running from attacker to
// attacked. On an acyclic graph exactly one labelling satisfies the IN/OUT rules
// below, so it must be the grounded one, and any evaluation order that reaches a
// fixed point finds it. In a fully evaluated tree UNDECIDED therefore only
// appears when attack information is missing (see `computeStatus`).

/**
 * Minimal argument node shape required by semantics evaluators.
 */
export interface EvaluationNode {
  id: string;
  status: ArgumentStatus;
  parentId: string | null;
  childIds: string[];
}

/** Map of argument id to evaluation node for semantics computation. */
export type EvaluationGraph = Map<string, EvaluationNode>;

/**
 * Runs grounded semantics evaluation on an entire argument graph until
 * a fixed point is reached.
 *
 * Returns a map of argument id -> new status for all nodes whose status
 * changed compared to the input graph.
 */
export function evaluateGroundedSemantics(graph: EvaluationGraph): Map<string, ArgumentStatus> {
  const changes = new Map<string, ArgumentStatus>();

  let updated = true;
  while (updated) {
    updated = false;

    for (const [id, node] of graph.entries()) {
      const newStatus = computeStatus(node, graph);
      if (newStatus !== node.status) {
        changes.set(id, newStatus);
        graph.set(id, { ...node, status: newStatus });
        updated = true;
      }
    }
  }

  return changes;
}

/**
 * Runs grounded semantics evaluation on a branch of the argument graph.
 *
 * Grounded semantics rules (applied bottom-up from new node to root):
 * - A node is OUT if it has at least one IN attacker (child)
 * - A node is IN if all its attackers (children) are OUT
 *   OR it has no attackers
 * - A node is UNDECIDED otherwise (some attackers are UNDECIDED,
 *   none are IN)
 *
 * @param graph     - Map of all nodes in the affected branch,
 *                    keyed by argument id
 * @param newNodeId - The id of the newly submitted argument
 *                    (the bottom of the branch)
 * @returns         - Map of argument id -> new status for all
 *                    nodes whose status has changed
 */
export function evaluateBranch(
  graph: EvaluationGraph,
  newNodeId: string,
): Map<string, ArgumentStatus> {
  const changes = new Map<string, ArgumentStatus>();

  // A node's status depends only on its direct attackers. Adding a leaf can
  // therefore only change the nodes on its path to the root; every other subtree
  // keeps the same attackers and the same status. The caller must still load
  // each path node's direct children so off-path siblings are counted.
  // Build traversal path from new node up to root
  const path: string[] = [];
  let current: string | null = newNodeId;

  while (current !== null) {
    path.push(current);
    const node = graph.get(current);
    if (!node) break;
    current = node.parentId;
  }

  // Evaluate bottom-up: new node first, root last
  for (const nodeId of path) {
    const node = graph.get(nodeId);
    if (!node) continue;

    const newStatus = computeStatus(node, graph);

    if (newStatus !== node.status) {
      changes.set(nodeId, newStatus);
      // Update in-memory graph so parent evaluation sees the change
      graph.set(nodeId, { ...node, status: newStatus });
    }
  }

  return changes;
}

function computeStatus(node: EvaluationNode, graph: EvaluationGraph): ArgumentStatus {
  // A node with no attackers (children) is IN
  if (node.childIds.length === 0) return "IN";

  const childStatuses: ArgumentStatus[] = [];
  for (const id of node.childIds) {
    const child = graph.get(id);
    // An attacker that was not loaded could be IN. Labelling this node IN or OUT
    // would be a guess, so it stays UNDECIDED until the full attacker set is known.
    if (!child) return "UNDECIDED";
    childStatuses.push(child.status);
  }

  // If any attacker is IN, this node is OUT
  if (childStatuses.some((s) => s === "IN")) return "OUT";

  // If every attacker is OUT, this node is IN
  if (childStatuses.every((s) => s === "OUT")) return "IN";

  // Some attackers UNDECIDED, none IN -> UNDECIDED
  return "UNDECIDED";
}
