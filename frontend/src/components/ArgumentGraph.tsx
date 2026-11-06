import { getSchemeById, renderArgumentText } from "@inch/types";
import type { ArgumentWithChildrenByStatus } from "@inch/types";
import { LocateFixed } from "lucide-react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import { createPortal } from "react-dom";
import { ArgumentDetailBody } from "@/components/ArgumentDetailBody";
import { ChildrenOutcomeStrip } from "@/components/ChildrenOutcomeStrip";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/stores";

interface ArgumentGraphProps {
  arguments: ArgumentWithChildrenByStatus[];
  selectedArgumentId: string | null;
  onNodeClick: (argumentId: string) => void;
}

// ---------------------------------------------------------------------------
// Node label fitting
// ---------------------------------------------------------------------------

const STEP = 72;

/** Truncates table previews and similar. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

/** Graph node label fitting (matches Cytoscape box ~52×52, text-max-width 46). */
const NODE_LABEL_MAX_CHARS = 240;
const NODE_TEXT_MAX_W = 46;
const NODE_TEXT_MAX_H = 42;
const GRAPH_FONT_MAX = 7;
const GRAPH_FONT_MIN = 3;
const GRAPH_LINE_HEIGHT = 1.2;

function wrapWordsToLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const tryLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(tryLine).width <= maxWidth) {
        line = tryLine;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      let remaining = word;
      while (remaining.length > 0) {
        let low = 1;
        let high = remaining.length;
        let fitLen = 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const chunk = remaining.slice(0, mid);
          if (ctx.measureText(chunk).width <= maxWidth) {
            fitLen = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        lines.push(remaining.slice(0, fitLen));
        remaining = remaining.slice(fitLen);
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function labelFitsAtFontSize(label: string, fontPx: number, maxW: number, maxH: number): boolean {
  if (typeof document === "undefined") return true;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  ctx.font = `500 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  const lines = wrapWordsToLines(ctx, label, maxW);
  const lh = fontPx * GRAPH_LINE_HEIGHT;
  return lines.length * lh <= maxH + 0.5;
}

function shrinkLabelToFitMinFont(
  label: string,
  fontPx: number,
  maxW: number,
  maxH: number,
): string {
  if (labelFitsAtFontSize(label, fontPx, maxW, maxH)) return label;
  let low = 1;
  let high = label.length;
  let best = 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${label.slice(0, mid).trimEnd()}…`;
    if (labelFitsAtFontSize(candidate, fontPx, maxW, maxH)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return `${label.slice(0, best).trimEnd()}…`;
}

/** Picks largest font in [GRAPH_FONT_MIN, GRAPH_FONT_MAX] that fits; may shorten at min. */
function fitGraphNodeLabel(raw: string): { label: string; fontSize: number } {
  const maxW = NODE_TEXT_MAX_W;
  const maxH = NODE_TEXT_MAX_H;
  const capped =
    raw.length > NODE_LABEL_MAX_CHARS
      ? `${raw.slice(0, NODE_LABEL_MAX_CHARS - 1).trimEnd()}…`
      : raw;

  if (typeof document === "undefined") {
    return { label: truncate(capped, 48), fontSize: GRAPH_FONT_MAX };
  }

  for (let px = GRAPH_FONT_MAX; px >= GRAPH_FONT_MIN; px--) {
    if (labelFitsAtFontSize(capped, px, maxW, maxH)) {
      return { label: capped, fontSize: px };
    }
  }
  return {
    label: shrinkLabelToFitMinFont(capped, GRAPH_FONT_MIN, maxW, maxH),
    fontSize: GRAPH_FONT_MIN,
  };
}

// ---------------------------------------------------------------------------
// Fullscreen side panel: child rows and panel width
// ---------------------------------------------------------------------------

const TABLE_PREVIEW_LEN = 96;

/** Status glyphs for counter-argument rows (aligned with {@link ArgumentView}). */
const STATUS_ROW_ICON: Record<string, string> = {
  IN: "✓",
  OUT: "✕",
  UNDECIDED: "?",
};
const STATUS_ROW_COLOR: Record<string, string> = {
  IN: "text-green-500",
  OUT: "text-red-500",
  UNDECIDED: "text-amber-500",
};

/** Fraction of viewport width for the fullscreen graph side panel (only ≥sm). */
const GRAPH_SIDE_PANEL_FR_KEY = "INCH.graphSidePanelWidthFr";
const PANEL_FR_MIN = 1 / 8;
const PANEL_FR_MAX = 1 / 3;
const PANEL_FR_DEFAULT = 1 / 4;

function clampPanelFr(n: number): number {
  if (!Number.isFinite(n)) return PANEL_FR_DEFAULT;
  return Math.min(PANEL_FR_MAX, Math.max(PANEL_FR_MIN, n));
}

function readInitialPanelFr(): number {
  if (typeof window === "undefined") return PANEL_FR_DEFAULT;
  try {
    const raw = localStorage.getItem(GRAPH_SIDE_PANEL_FR_KEY);
    if (raw == null) return PANEL_FR_DEFAULT;
    return clampPanelFr(Number(raw));
  } catch {
    return PANEL_FR_DEFAULT;
  }
}

/** One-line preview for child rows (prefers stored argument text). */
function argumentTablePreview(arg: ArgumentWithChildrenByStatus): string {
  const scheme = getSchemeById(arg.schemeId);
  const conclusion = scheme?.conclusion ?? "";
  const formal = renderArgumentText(
    conclusion,
    arg.variables.map((v) => ({ variableId: v.variableId, value: v.value })),
  );
  const nl = arg.argumentText?.trim();
  const raw = nl != null && nl.length > 0 ? nl : formal;
  return truncate(raw, TABLE_PREVIEW_LEN);
}

// ---------------------------------------------------------------------------
// Viewport and tree layout (subtree widths, "+N more" overflow)
// ---------------------------------------------------------------------------

/** Max real child nodes drawn per parent; if exceeded, last slot is a “+N more” diamond. */
const MAX_GRAPH_CHILDREN = 5;
const GRAPH_SIBLING_GAP = 20;
const ROOT_FOREST_GAP = 56;

/**
 * Fullscreen graph only: Cytoscape `wheelSensitivity` (positive multiplier; library default is 1).
 * Increase for faster scroll/trackpad zoom; decrease for finer steps.
 */
const GRAPH_FULLSCREEN_WHEEL_SENSITIVITY = 1.35;

/** Fullscreen “go to current”: target node bbox vs viewport (smaller axis), after zoom. */
const GRAPH_FOCUS_CURRENT_FRAC = 0.42;
const GRAPH_FOCUS_CURRENT_DURATION_MS = 620;

/**
 * Animates pan/zoom so the argument node is centered and fills roughly
 * {@link GRAPH_FOCUS_CURRENT_FRAC} of the smaller viewport dimension.
 */
function animateViewportToArgumentNode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy: any,
  nodeId: string,
): boolean {
  if (!cy || typeof cy.animate !== "function") return false;
  if (isGraphOverflowNodeId(nodeId)) return false;
  try {
    cy.resize();
  } catch {
    /* ignore */
  }
  const n = cy.getElementById(nodeId);
  if (!n || n.length === 0 || typeof n.boundingBox !== "function") return false;
  const bb = n.boundingBox({ includeLabels: true });
  if (bb == null || !Number.isFinite(bb.w) || !Number.isFinite(bb.h) || bb.w <= 0 || bb.h <= 0) {
    return false;
  }
  const cx = (bb.x1 + bb.x2) / 2;
  const cy0 = (bb.y1 + bb.y2) / 2;
  const vw = cy.width();
  const vh = cy.height();
  if (!(vw > 0) || !(vh > 0)) return false;

  let z = Math.min((GRAPH_FOCUS_CURRENT_FRAC * vw) / bb.w, (GRAPH_FOCUS_CURRENT_FRAC * vh) / bb.h);
  const zMin = typeof cy.minZoom === "function" ? cy.minZoom() : 1e-50;
  const zMax = typeof cy.maxZoom === "function" ? cy.maxZoom() : 1e50;
  z = Math.min(zMax, Math.max(zMin, z));

  const panX = vw / 2 - cx * z;
  const panY = vh / 2 - cy0 * z;

  cy.animate(
    {
      zoom: z,
      pan: { x: panX, y: panY },
    },
    {
      duration: GRAPH_FOCUS_CURRENT_DURATION_MS,
      easing: "ease-out-cubic",
    },
  );
  return true;
}

const GRAPH_OVERFLOW_HINT =
  "These counter-arguments are not drawn as separate nodes on the map. Select the parent argument on the graph, then open the full argument page and use the Counter-arguments list to browse every reply.";

const GRAPH_MINIMAP_SPINE_HINT =
  "The minimap only shows a short path from the root to here. Expand the graph to see every argument along the chain.";

type LayoutTreeNode = {
  id: string;
  arg: ArgumentWithChildrenByStatus | null;
  isOverflow: boolean;
  overflowCount?: number;
  children: LayoutTreeNode[];
};

function compareGraphChildPriority(
  a: ArgumentWithChildrenByStatus,
  b: ArgumentWithChildrenByStatus,
): number {
  const dc = b.childIds.length - a.childIds.length;
  if (dc !== 0) return dc;
  const desc = b.descendantCount - a.descendantCount;
  if (desc !== 0) return desc;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Picks which direct children appear on the graph for a parent.
 * When there are more than {@link MAX_GRAPH_CHILDREN}, keeps four nodes plus a diamond;
 * children with more replies are preferred. If the globally selected argument is a direct
 * child but would not make the top four, it replaces the fourth slot (the weakest of the four).
 */
function pickVisibleGraphChildren(
  parentId: string,
  all: ArgumentWithChildrenByStatus[],
  selectedArgumentId: string | null,
): { childArgs: ArgumentWithChildrenByStatus[]; overflow: number } {
  const rawList = all.filter((c) => c.parentId === parentId);
  const byId = new Map<string, ArgumentWithChildrenByStatus>();
  for (const c of rawList) {
    if (!byId.has(c.id)) byId.set(c.id, c);
  }
  const raw = [...byId.values()];
  if (raw.length <= MAX_GRAPH_CHILDREN) {
    return {
      childArgs: [...raw].sort(compareGraphChildPriority),
      overflow: 0,
    };
  }
  const sorted = [...raw].sort(compareGraphChildPriority);
  const topFour = sorted.slice(0, 4);
  let childArgs = topFour;
  if (
    selectedArgumentId != null &&
    raw.some((c) => c.id === selectedArgumentId) &&
    !topFour.some((c) => c.id === selectedArgumentId)
  ) {
    const sel = raw.find((c) => c.id === selectedArgumentId)!;
    childArgs = [...topFour.slice(0, 3), sel];
  }
  const overflow = raw.length - childArgs.length;
  return { childArgs, overflow };
}

function buildLayoutTree(
  arg: ArgumentWithChildrenByStatus,
  all: ArgumentWithChildrenByStatus[],
  selectedArgumentId: string | null,
): LayoutTreeNode {
  const { childArgs, overflow } = pickVisibleGraphChildren(arg.id, all, selectedArgumentId);
  const children: LayoutTreeNode[] = childArgs.map((c) =>
    buildLayoutTree(c, all, selectedArgumentId),
  );
  if (overflow > 0) {
    children.push({
      id: `__more__${arg.id}`,
      arg: null,
      isOverflow: true,
      overflowCount: overflow,
      children: [],
    });
  }
  return { id: arg.id, arg, isOverflow: false, children };
}

function measureSubtreeWidth(n: LayoutTreeNode, widths: Map<string, number>): number {
  if (n.isOverflow) {
    widths.set(n.id, STEP);
    return STEP;
  }
  if (n.children.length === 0) {
    widths.set(n.id, STEP);
    return STEP;
  }
  let sum = 0;
  for (const c of n.children) {
    sum += measureSubtreeWidth(c, widths);
  }
  sum += (n.children.length - 1) * GRAPH_SIBLING_GAP;
  const w = Math.max(STEP, sum);
  widths.set(n.id, w);
  return w;
}

function assignSubtreePositions(
  n: LayoutTreeNode,
  centerX: number,
  depth: number,
  positions: Map<string, { x: number; y: number }>,
  widths: Map<string, number>,
): void {
  positions.set(n.id, { x: centerX, y: depth * STEP });
  if (n.children.length === 0) return;
  const wids = n.children.map((c) => widths.get(c.id)!);
  const total = wids.reduce((a, b) => a + b, 0) + (n.children.length - 1) * GRAPH_SIBLING_GAP;
  let left = centerX - total / 2;
  for (let i = 0; i < n.children.length; i++) {
    const c = n.children[i];
    const cw = wids[i]!;
    assignSubtreePositions(c, left + cw / 2, depth + 1, positions, widths);
    left += cw + GRAPH_SIBLING_GAP;
  }
}

/** Full-graph overflow diamonds and minimap spine abstractions — not navigable as arguments. */
function isGraphOverflowNodeId(id: string): boolean {
  return id.startsWith("__more__") || id.startsWith("__spine_more__");
}

type GraphArgumentNodeOptions = {
  /** Minimap only: second line shows {@link ArgumentWithChildrenByStatus.descendantCount}. */
  showDescendantCount?: boolean;
  /** When set, overrides depth-based ellipse/rectangle (minimap horizontal rows use one shape). */
  fixedShape?: "ellipse" | "rectangle";
};

/** One positioned graph node (same shape/label rules as the full tree). */
function graphArgumentNodeElement(
  arg: ArgumentWithChildrenByStatus,
  x: number,
  y: number,
  depth: number,
  options?: GraphArgumentNodeOptions,
): any {
  const scheme = getSchemeById(arg.schemeId);
  const conclusion = scheme?.conclusion ?? "";
  const formalLabel = renderArgumentText(
    conclusion,
    arg.variables.map((v) => ({ variableId: v.variableId, value: v.value })),
  );
  const nl = arg.argumentText?.trim();
  const baseLabel = nl != null && nl.length > 0 ? nl : formalLabel;
  const rawLabel =
    options?.showDescendantCount === true ? `${baseLabel}\n${arg.descendantCount}` : baseLabel;
  const { label, fontSize } = fitGraphNodeLabel(rawLabel);
  const nodeShape =
    options?.fixedShape != null ? options.fixedShape : depth % 2 === 0 ? "ellipse" : "rectangle";
  return {
    data: {
      id: arg.id,
      label,
      fontSize,
      status: arg.status,
      schemeId: arg.schemeId,
      shape: nodeShape,
    },
    position: { x, y },
  };
}

// ---------------------------------------------------------------------------
// Minimap elements (root→current spine, siblings, direct replies)
// ---------------------------------------------------------------------------

/** If the root→current chain has more than this many nodes, collapse the middle into a diamond. */
const MINIMAP_SPINE_FULL_MAX = 5;

function buildAncestorPathFromRoot(
  sel: ArgumentWithChildrenByStatus,
  idToArg: Map<string, ArgumentWithChildrenByStatus>,
): ArgumentWithChildrenByStatus[] {
  const chain: ArgumentWithChildrenByStatus[] = [];
  let cur: ArgumentWithChildrenByStatus | undefined = sel;
  while (cur != null) {
    chain.push(cur);
    if (cur.parentId == null || !idToArg.has(cur.parentId)) break;
    cur = idToArg.get(cur.parentId);
  }
  chain.reverse();
  return chain;
}

type MinimapSpineSeg =
  | { kind: "arg"; arg: ArgumentWithChildrenByStatus }
  | { kind: "diamond"; hiddenCount: number };

function buildMinimapSpineSegments(path: ArgumentWithChildrenByStatus[]): MinimapSpineSeg[] {
  const L = path.length;
  if (L <= MINIMAP_SPINE_FULL_MAX) {
    return path.map((arg) => ({ kind: "arg", arg }));
  }
  const hiddenCount = L - 4;
  return [
    { kind: "arg", arg: path[0]! },
    { kind: "arg", arg: path[1]! },
    { kind: "diamond", hiddenCount },
    { kind: "arg", arg: path[L - 2]! },
    { kind: "arg", arg: path[L - 1]! },
  ];
}

function minimapSpineSegNodeId(seg: MinimapSpineSeg, selId: string): string {
  if (seg.kind === "arg") return seg.arg.id;
  return `__spine_more__${selId}`;
}

/**
 * Minimap: vertical spine from root to the **parent** of the current argument (with the same
 * long-chain diamond abstraction as the full graph). Below that: the parent’s direct children
 * (siblings + current) using {@link pickVisibleGraphChildren} when there are more than five.
 * Then the current argument’s direct replies with the same cap and `+N more` diamond.
 * Without a selection: top-level roots in a row. Minimap argument nodes show descendant counts.
 */
function buildMinimapNeighborhoodElements(
  args: ArgumentWithChildrenByStatus[],
  idToArg: Map<string, ArgumentWithChildrenByStatus>,
  selectedArgumentId: string | null,
): any[] {
  if (args.length === 0) return [];
  const nodeEles: any[] = [];
  const edgeEles: any[] = [];
  const highlightedAncestorEdges = new Set<string>();
  if (selectedArgumentId != null) {
    let cur = idToArg.get(selectedArgumentId);
    while (cur != null && cur.parentId != null && idToArg.has(cur.parentId)) {
      highlightedAncestorEdges.add(`${cur.id}->${cur.parentId}`);
      cur = idToArg.get(cur.parentId);
    }
  }

  const addMinimapEdge = (
    uniqueKey: string,
    childId: string,
    parentId: string,
    forceHighlight = false,
  ) => {
    const parentOk = idToArg.has(parentId) || parentId.startsWith("__spine_more__");
    const childOk =
      idToArg.has(childId) ||
      childId.startsWith("__spine_more__") ||
      childId.startsWith("__more__");
    if (!parentOk || !childOk) return;
    edgeEles.push({
      data: {
        id: uniqueKey,
        source: childId,
        target: parentId,
        currentToParent:
          forceHighlight || highlightedAncestorEdges.has(`${childId}->${parentId}`) ? "yes" : "no",
      },
    });
  };

  const sel = selectedArgumentId != null ? idToArg.get(selectedArgumentId) : undefined;

  if (!sel) {
    const roots = args
      .filter((a) => a.parentId === null || !idToArg.has(a.parentId))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (roots.length === 0) return [];
    const rowW = (roots.length - 1) * (STEP + GRAPH_SIBLING_GAP) + STEP;
    const startX = -rowW / 2 + STEP / 2;
    const miniOpts = { showDescendantCount: true } as const;
    roots.forEach((r, i) => {
      nodeEles.push(
        graphArgumentNodeElement(r, startX + i * (STEP + GRAPH_SIBLING_GAP), 0, 0, miniOpts),
      );
    });
    return nodeEles;
  }

  const path = buildAncestorPathFromRoot(sel, idToArg);
  const pathAbove = path.slice(0, -1);
  const segments =
    pathAbove.length === 0
      ? ([{ kind: "arg", arg: sel } as const] satisfies MinimapSpineSeg[])
      : buildMinimapSpineSegments(pathAbove);
  const miniOpts = { showDescendantCount: true } as const;

  for (let i = 0; i < segments.length - 1; i++) {
    const upper = segments[i]!;
    const lower = segments[i + 1]!;
    addMinimapEdge(
      `mm-sp-${i}-${minimapSpineSegNodeId(lower, sel.id)}-${minimapSpineSegNodeId(upper, sel.id)}`,
      minimapSpineSegNodeId(lower, sel.id),
      minimapSpineSegNodeId(upper, sel.id),
      true,
    );
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const y = i * STEP;
    if (seg.kind === "diamond") {
      nodeEles.push({
        data: {
          id: minimapSpineSegNodeId(seg, sel.id),
          label: `${seg.hiddenCount}\n…`,
          fontSize: 6,
          overflow: "yes",
          shape: "diamond",
        },
        position: { x: 0, y },
      });
    } else {
      nodeEles.push(graphArgumentNodeElement(seg.arg, 0, y, i, miniOpts));
    }
  }

  let yNext = segments.length * STEP;
  const parentInGraph =
    sel.parentId != null && idToArg.has(sel.parentId) ? idToArg.get(sel.parentId)! : null;

  if (parentInGraph) {
    const { childArgs: sibArgs, overflow: sibOverflow } = pickVisibleGraphChildren(
      parentInGraph.id,
      args,
      selectedArgumentId,
    );
    type SibCell =
      | { kind: "arg"; arg: ArgumentWithChildrenByStatus }
      | { kind: "more"; count: number };
    const sibRow: SibCell[] = sibArgs.map((a) => ({ kind: "arg", arg: a }));
    if (sibOverflow > 0) {
      sibRow.push({ kind: "more", count: sibOverflow });
    }
    const nS = sibRow.length;
    const rowSw = (nS - 1) * (STEP + GRAPH_SIBLING_GAP) + STEP;
    const sStart = -rowSw / 2 + STEP / 2;
    sibRow.forEach((cell, i) => {
      const x = sStart + i * (STEP + GRAPH_SIBLING_GAP);
      if (cell.kind === "arg") {
        addMinimapEdge(
          `mm-sib-${i}-${cell.arg.id}-${parentInGraph.id}`,
          cell.arg.id,
          parentInGraph.id,
        );
        nodeEles.push(graphArgumentNodeElement(cell.arg, x, yNext, segments.length, miniOpts));
      } else {
        const moreId = `__more__${parentInGraph.id}`;
        addMinimapEdge(`mm-sib-${i}-${moreId}-${parentInGraph.id}`, moreId, parentInGraph.id);
        nodeEles.push({
          data: {
            id: moreId,
            label: `+${cell.count}\nmore`,
            fontSize: 6,
            overflow: "yes",
            shape: "diamond",
          },
          position: { x, y: yNext },
        });
      }
    });
    yNext += STEP;
  }

  const { childArgs: kidArgs, overflow: kidOverflow } = pickVisibleGraphChildren(
    sel.id,
    args,
    selectedArgumentId,
  );
  type KidCell =
    | { kind: "arg"; arg: ArgumentWithChildrenByStatus }
    | { kind: "more"; count: number };
  const kidRow: KidCell[] = kidArgs.map((a) => ({ kind: "arg", arg: a }));
  if (kidOverflow > 0) {
    kidRow.push({ kind: "more", count: kidOverflow });
  }
  const nK = kidRow.length;
  if (nK > 0) {
    const rowKw = (nK - 1) * (STEP + GRAPH_SIBLING_GAP) + STEP;
    const kStart = -rowKw / 2 + STEP / 2;
    /** Depth only affects label fit; shape comes from {@link kidArgOpts} (ellipse under rectangles). */
    const kidGraphDepth = parentInGraph ? segments.length + 1 : 1;
    kidRow.forEach((cell, i) => {
      const x = kStart + i * (STEP + GRAPH_SIBLING_GAP);
      if (cell.kind === "arg") {
        addMinimapEdge(`mm-kid-${i}-${cell.arg.id}-${sel.id}`, cell.arg.id, sel.id);
        nodeEles.push(graphArgumentNodeElement(cell.arg, x, yNext, kidGraphDepth, miniOpts));
      } else {
        const moreId = `__more__${sel.id}`;
        addMinimapEdge(`mm-kid-${i}-${moreId}-${sel.id}`, moreId, sel.id);
        nodeEles.push({
          data: {
            id: moreId,
            label: `+${cell.count}\nmore`,
            fontSize: 6,
            overflow: "yes",
            shape: "diamond",
          },
          position: { x, y: yNext },
        });
      }
    });
  }

  return [...nodeEles, ...edgeEles];
}

// ---------------------------------------------------------------------------
// Full-graph elements and styling
// ---------------------------------------------------------------------------

function buildCytoscapeElements(
  args: ArgumentWithChildrenByStatus[],
  idToArg: Map<string, ArgumentWithChildrenByStatus>,
  selectedArgumentId: string | null,
): any[] {
  const allRoots = args.filter((a) => a.parentId === null || !idToArg.has(a.parentId));
  let roots = allRoots;
  if (selectedArgumentId != null && idToArg.has(selectedArgumentId)) {
    let cur = idToArg.get(selectedArgumentId)!;
    while (cur.parentId != null && idToArg.has(cur.parentId)) {
      cur = idToArg.get(cur.parentId)!;
    }
    roots = [cur];
  }
  roots.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const forest = roots.map((r) => buildLayoutTree(r, args, selectedArgumentId));
  const widths = new Map<string, number>();
  const positions = new Map<string, { x: number; y: number }>();

  let cursor = 0;
  for (const root of forest) {
    const w = measureSubtreeWidth(root, widths);
    assignSubtreePositions(root, cursor + w / 2, 0, positions, widths);
    cursor += w + ROOT_FOREST_GAP;
  }

  if (positions.size > 0) {
    const xs = [...positions.values()].map((p) => p.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const [id, p] of positions) {
      positions.set(id, { x: p.x - mid, y: p.y });
    }
  }

  const elements: any[] = [];
  const highlightedAncestorEdges = new Set<string>();
  if (selectedArgumentId != null) {
    let cur = idToArg.get(selectedArgumentId);
    while (cur != null && cur.parentId != null && idToArg.has(cur.parentId)) {
      highlightedAncestorEdges.add(`${cur.id}->${cur.parentId}`);
      cur = idToArg.get(cur.parentId);
    }
  }

  function visit(n: LayoutTreeNode, parentId: string | null, depth: number) {
    const pos = positions.get(n.id);
    if (!pos) return;

    if (n.isOverflow && n.overflowCount != null) {
      if (parentId != null && idToArg.has(parentId)) {
        elements.push({
          data: {
            id: `e-${n.id}-${parentId}`,
            source: n.id,
            target: parentId,
            currentToParent: highlightedAncestorEdges.has(`${n.id}->${parentId}`) ? "yes" : "no",
          },
        });
      }
      elements.push({
        data: {
          id: n.id,
          label: `+${n.overflowCount}\nmore`,
          fontSize: 6,
          overflow: "yes",
          shape: "diamond",
        },
        position: { x: pos.x, y: pos.y },
      });
      return;
    }

    const arg = n.arg!;
    if (parentId != null && idToArg.has(parentId)) {
      elements.push({
        data: {
          id: `e-${arg.id}-${parentId}`,
          source: arg.id,
          target: parentId,
          currentToParent: highlightedAncestorEdges.has(`${arg.id}->${parentId}`) ? "yes" : "no",
        },
      });
    }

    elements.push(graphArgumentNodeElement(arg, pos.x, pos.y, depth));

    for (const ch of n.children) {
      visit(ch, arg.id, depth + 1);
    }
  }

  for (const root of forest) {
    visit(root, null, 0);
  }

  return elements;
}

/** Light mode: pale status tint on near-white; dark text. */
const LIGHT_NODE = {
  defaultBg: "#fafafa",
  defaultBorder: "#e4e4e7",
  fill: {
    IN: "#ecfdf3",
    OUT: "#fef2f2",
    UNDECIDED: "#fffbeb",
  },
  statusBorder: {
    IN: "#86efac",
    OUT: "#fca5a5",
    UNDECIDED: "#fcd34d",
  },
  label: "#0a0a0a",
  selectedBorder: "#0a0a0a",
} as const;

/** Dark mode: near-black interior with a subtle status hue; light text. */
const DARK_NODE = {
  defaultBg: "#171717",
  defaultBorder: "#3f3f46",
  fill: {
    IN: "#121c17",
    OUT: "#1a1214",
    UNDECIDED: "#1a170f",
  },
  statusBorder: {
    IN: "#2d5a3d",
    OUT: "#7f3d45",
    UNDECIDED: "#6b5420",
  },
  label: "#f4f4f5",
  selectedBorder: "#fafafa",
} as const;

/** High-contrast accent for current -> parent edge in both themes. */
const CURRENT_TO_PARENT_EDGE_COLOR = "#a855f7";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the argument graph minimap and fullscreen graph using Cytoscape.
 *
 * Behavior highlights:
 * - Light: pale status-tinted fills with dark text. Dark: muted status-tinted dark fills with light text.
 * - Minimap: vertical root→parent spine (collapsed middle when long), sibling row under the parent
 *   (same +N diamond cap as the full graph), then the current node’s direct replies with the same
 *   cap; without a selection, top-level roots only. Fullscreen graph still shows the whole tree.
 * - Layout: children centered under each parent (subtree widths); >5 children → “+N more” diamond.
 * - When a parent overflows, shown children favor those with more direct replies (then size of subtree);
 *   the page’s selected argument, if a hidden direct child, swaps into the fourth graph slot.
 * - Tap the diamond for guidance (parent + Counter-arguments on the argument page).
 * - Maintains selection sync with current argument id.
 * - Fullscreen: resizable side panel (⅛–⅓ viewport, default ¼; width persisted in localStorage).
 *   Top-left “Go to current” animates pan/zoom to the page’s selected argument (~42% of viewport).
 *   Child rows update graph selection only. "Go to argument" navigates and closes.
 *
 * @param props Arguments for one subtopic, current selection, and node click handler.
 * @returns Minimap and optional fullscreen overlay.
 */
export function ArgumentGraph({
  arguments: args,
  selectedArgumentId,
  onNodeClick,
}: ArgumentGraphProps) {
  const { theme } = useTheme();
  const { isFullscreen, setFullscreen, showMinimap } = useGraphStore();
  const [visible, setVisible] = useState(false);
  /** Node whose details are shown in the fullscreen side panel (not minimap taps). */
  const [panelArgumentId, setPanelArgumentId] = useState<string | null>(null);
  /** Child list row hover → highlight matching node on the fullscreen graph. */
  const [hoveredChildId, setHoveredChildId] = useState<string | null>(null);
  /** Shown when the overflow diamond is tapped (minimap or fullscreen). */
  const [overflowGraphHint, setOverflowGraphHint] = useState<string | null>(null);
  const overflowHintSetterRef = useRef(setOverflowGraphHint);
  overflowHintSetterRef.current = setOverflowGraphHint;
  const prevFullscreen = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cyFullRef = useRef<any>(null);
  /** Minimap Cytoscape instance — used to refit viewport when the neighborhood set changes. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const miniCyRef = useRef<any>(null);
  const [sidePanelFr, setSidePanelFr] = useState(() => readInitialPanelFr());
  const sidePanelFrRef = useRef(sidePanelFr);
  sidePanelFrRef.current = sidePanelFr;
  const panelResizeDragRef = useRef<{ startX: number; startFr: number } | null>(null);

  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktopLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const onSidePanelResizePointerDown = useCallback(
    (e: { clientX: number; button: number; preventDefault: () => void }) => {
      if (e.button !== 0 || !isDesktopLayout) return;
      e.preventDefault();
      const startX = e.clientX;
      const startFr = sidePanelFrRef.current;
      panelResizeDragRef.current = { startX, startFr };

      const handleMove = (ev: PointerEvent) => {
        const d = panelResizeDragRef.current;
        if (!d) return;
        const w = window.innerWidth || 1;
        const next = clampPanelFr(d.startFr + (ev.clientX - d.startX) / w);
        sidePanelFrRef.current = next;
        setSidePanelFr(next);
      };
      const endDrag = () => {
        panelResizeDragRef.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        try {
          localStorage.setItem(
            GRAPH_SIDE_PANEL_FR_KEY,
            String(clampPanelFr(sidePanelFrRef.current)),
          );
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [isDesktopLayout],
  );

  // Enter animation when fullscreen opens
  useEffect(() => {
    if (isFullscreen) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      setOverflowGraphHint(null);
    }
  }, [isFullscreen]);

  // Initialise / clear panel when entering or leaving fullscreen
  useEffect(() => {
    if (isFullscreen && !prevFullscreen.current) {
      const sid = selectedArgumentId;
      setPanelArgumentId(sid != null && args.some((a) => a.id === sid) ? sid : null);
    }
    if (!isFullscreen && prevFullscreen.current) {
      setPanelArgumentId(null);
    }
    prevFullscreen.current = isFullscreen;
  }, [isFullscreen, selectedArgumentId, args]);

  useEffect(() => {
    setHoveredChildId(null);
  }, [panelArgumentId]);

  useEffect(() => {
    if (!isFullscreen) {
      cyFullRef.current = null;
      setHoveredChildId(null);
      return;
    }
    const cy = cyFullRef.current as {
      elements: (s: string) => { removeClass: (c: string) => void };
      getElementById: (id: string) => { length: number; addClass: (c: string) => void };
      batch?: (fn: () => void) => void;
    } | null;
    if (!cy) return;
    const apply = () => {
      cy.elements("node").removeClass("selected");
      if (panelArgumentId) {
        const n = cy.getElementById(panelArgumentId);
        if (n.length) n.addClass("selected");
      }
    };
    if (typeof cy.batch === "function") {
      cy.batch(apply);
    } else {
      apply();
    }
  }, [panelArgumentId, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const cy = cyFullRef.current as {
      elements: (s: string) => { removeClass: (c: string) => void };
      getElementById: (id: string) => { length: number; addClass: (c: string) => void };
      batch?: (fn: () => void) => void;
    } | null;
    if (!cy) return;
    const applyHover = () => {
      cy.elements("node").removeClass("child-row-hover");
      if (hoveredChildId) {
        const n = cy.getElementById(hoveredChildId);
        if (n.length) n.addClass("child-row-hover");
      }
    };
    if (typeof cy.batch === "function") {
      cy.batch(applyHover);
    } else {
      applyHover();
    }
  }, [hoveredChildId, isFullscreen]);

  const panelCqSubstitution = useMemo(() => {
    const argument =
      panelArgumentId != null ? args.find((a) => a.id === panelArgumentId) : undefined;
    if (!argument || argument.selectedCqId == null) return null;
    if (argument.parentId) {
      const parent = args.find((a) => a.id === argument.parentId);
      if (!parent) return null;
      return {
        schemeId: parent.schemeId,
        cqId: argument.selectedCqId,
        variableValues: (parent.variables ?? []).map((v) => ({
          variableId: v.variableId,
          value: v.value,
        })),
      };
    }
    return {
      schemeId: argument.schemeId,
      cqId: argument.selectedCqId,
      variableValues: (argument.variables ?? []).map((v) => ({
        variableId: v.variableId,
        value: v.value,
      })),
    };
  }, [panelArgumentId, args]);

  const panelChildren = useMemo(() => {
    if (panelArgumentId == null) return [];
    const parent = args.find((a) => a.id === panelArgumentId);
    if (!parent) return [];
    return args
      .filter((c) => c.parentId === parent.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [panelArgumentId, args]);

  const idToArg = useMemo(() => new Map(args.map((a) => [a.id, a])), [args]);
  const elements = useMemo(
    () => buildCytoscapeElements(args, idToArg, selectedArgumentId),
    [args, idToArg, selectedArgumentId],
  );

  const minimapElements = useMemo(
    () => buildMinimapNeighborhoodElements(args, idToArg, selectedArgumentId),
    [args, idToArg, selectedArgumentId],
  );

  const minimapScreenReaderArgs = useMemo(() => {
    const sel = selectedArgumentId != null ? idToArg.get(selectedArgumentId) : undefined;
    if (!sel) {
      return args.filter((a) => a.parentId === null || !idToArg.has(a.parentId));
    }
    const ids = new Set<string>();
    buildAncestorPathFromRoot(sel, idToArg).forEach((a) => ids.add(a.id));
    if (sel.parentId != null && idToArg.has(sel.parentId)) {
      args.filter((c) => c.parentId === sel.parentId).forEach((c) => ids.add(c.id));
    }
    args.filter((c) => c.parentId === sel.id).forEach((c) => ids.add(c.id));
    return args.filter((a) => ids.has(a.id));
  }, [args, idToArg, selectedArgumentId]);

  useEffect(() => {
    if (!showMinimap) return;
    const cy = miniCyRef.current;
    if (!cy) return;
    const id = requestAnimationFrame(() => {
      try {
        cy.resize();
        cy.fit(undefined, 16);
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [minimapElements, showMinimap]);

  const open = () => setFullscreen(true);

  const close = () => {
    setVisible(false);
    setTimeout(() => setFullscreen(false), 300);
  };

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const nodePalette = isDark ? DARK_NODE : LIGHT_NODE;
  const edgeColor = isDark ? "#ffffff" : "#000000";

  // ── Stylesheet ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stylesheet: any[] = [
    {
      selector: "node",
      style: {
        "background-color": nodePalette.defaultBg,
        "border-color": nodePalette.defaultBorder,
        "border-width": 1,
        color: nodePalette.label,
        label: "data(label)",
        "font-size": "data(fontSize)",
        "font-weight": 500,
        "text-valign": "center",
        "text-halign": "center",
        width: 52,
        height: 52,
        "text-wrap": "wrap",
        "text-max-width": 46,
      },
    },
    {
      selector: 'node[shape="ellipse"]',
      style: { shape: "ellipse" },
    },
    {
      selector: 'node[shape="rectangle"]',
      style: { shape: "rectangle" },
    },
    {
      selector: 'node[shape="diamond"]',
      style: { shape: "diamond" },
    },
    {
      selector: 'node[overflow = "yes"]',
      style: {
        "background-color": nodePalette.defaultBg,
        "border-color": nodePalette.defaultBorder,
        "border-width": 2,
        "border-style": "dashed",
        color: nodePalette.label,
        "font-size": 6,
        width: 44,
        height: 44,
        "text-max-width": 40,
      },
    },
    {
      selector: "node[status='IN']",
      style: {
        "background-color": nodePalette.fill.IN,
        "border-color": nodePalette.statusBorder.IN,
        "border-width": 2,
        color: nodePalette.label,
      },
    },
    {
      selector: "node[status='OUT']",
      style: {
        "background-color": nodePalette.fill.OUT,
        "border-color": nodePalette.statusBorder.OUT,
        "border-width": 2,
        color: nodePalette.label,
      },
    },
    {
      selector: "node[status='UNDECIDED']",
      style: {
        "background-color": nodePalette.fill.UNDECIDED,
        "border-color": nodePalette.statusBorder.UNDECIDED,
        "border-width": 2,
        color: nodePalette.label,
      },
    },
    {
      selector: "node.selected",
      style: {
        "border-width": 4,
        "border-style": "double",
        "border-color": nodePalette.selectedBorder,
      },
    },
    {
      selector: "node.child-row-hover",
      style: {
        "border-width": 3,
        "border-style": "solid",
        "border-color": "#2563eb",
      },
    },
    {
      selector: "edge",
      style: {
        "line-color": edgeColor,
        "target-arrow-color": edgeColor,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        width: 1,
      },
    },
    {
      selector: 'edge[currentToParent = "yes"]',
      style: {
        "line-color": CURRENT_TO_PARENT_EDGE_COLOR,
        "target-arrow-color": CURRENT_TO_PARENT_EDGE_COLOR,
        width: 2,
      },
    },
  ];

  // ── Selection sync ───────────────────────────────────────────────────────────
  const miniPropsRef = useRef({ selectedArgumentId, onNodeClick });
  miniPropsRef.current = { selectedArgumentId, onNodeClick };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onCyMiniInit = useCallback((cy: any) => {
    miniCyRef.current = cy;
    const sync = () => {
      cy.elements("node").removeClass("selected");
      const sid = miniPropsRef.current.selectedArgumentId;
      if (sid) {
        const node = cy.getElementById(sid);
        if (node.length) node.addClass("selected");
      }
    };
    cy.ready(() => {
      try {
        cy.resize();
        cy.fit(undefined, 16);
      } catch {
        /* ignore */
      }
    });
    cy.off("render");
    cy.off("tap", "node");
    cy.on("render", sync);
    cy.on("tap", "node", (ev: { target: { id: () => string } }) => {
      const id = ev.target.id();
      if (isGraphOverflowNodeId(id)) {
        overflowHintSetterRef.current(
          id.startsWith("__spine_more__") ? GRAPH_MINIMAP_SPINE_HINT : GRAPH_OVERFLOW_HINT,
        );
        return;
      }
      miniPropsRef.current.onNodeClick(id);
    });
    sync();
  }, []);

  const panelArgumentIdRef = useRef(panelArgumentId);
  panelArgumentIdRef.current = panelArgumentId;
  const hoveredChildIdRef = useRef(hoveredChildId);
  hoveredChildIdRef.current = hoveredChildId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onCyFullInit = useCallback((cy: any) => {
    cyFullRef.current = cy;
    const sync = () => {
      cy.elements("node").removeClass("selected");
      cy.elements("node").removeClass("child-row-hover");
      const sid = panelArgumentIdRef.current;
      if (sid) {
        const node = cy.getElementById(sid);
        if (node.length) node.addClass("selected");
      }
      const hid = hoveredChildIdRef.current;
      if (hid) {
        const hn = cy.getElementById(hid);
        if (hn.length) hn.addClass("child-row-hover");
      }
    };
    cy.off("render");
    cy.off("tap", "node");
    cy.on("render", sync);
    cy.on("tap", "node", (ev: { target: { id: () => string } }) => {
      const id = ev.target.id();
      if (isGraphOverflowNodeId(id)) {
        overflowHintSetterRef.current(
          id.startsWith("__spine_more__") ? GRAPH_MINIMAP_SPINE_HINT : GRAPH_OVERFLOW_HINT,
        );
        return;
      }
      setPanelArgumentId(id);
    });
    sync();
  }, []);

  // ── Expand / close icons ─────────────────────────────────────────────────────
  const ExpandIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );

  const CloseIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  const panelArgument = panelArgumentId != null ? idToArg.get(panelArgumentId) : undefined;

  const goToArgumentFromPanel = () => {
    if (panelArgumentId == null) return;
    onNodeClick(panelArgumentId);
    setFullscreen(false);
  };

  const canFocusCurrentOnGraph = selectedArgumentId != null && idToArg.has(selectedArgumentId);

  const goToCurrentOnFullGraph = useCallback(() => {
    const cy = cyFullRef.current;
    if (cy == null || selectedArgumentId == null) return;
    animateViewportToArgumentNode(cy, selectedArgumentId);
  }, [selectedArgumentId]);

  return (
    <>
      {overflowGraphHint != null
        ? createPortal(
            <div
              className="fixed bottom-6 left-1/2 z-[60] w-[min(100vw-2rem,28rem)] -translate-x-1/2 rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm text-foreground">{overflowGraphHint}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setOverflowGraphHint(null)}
              >
                Dismiss
              </Button>
            </div>,
            document.body,
          )
        : null}
      {/* Minimap — visibility driven by graphStore.showMinimap */}
      {showMinimap && (
        <div role="region" aria-label="Argument graph">
          <div className="w-full aspect-[3/2] shrink-0 border border-border rounded-md overflow-hidden bg-background relative">
            <CytoscapeComponent
              elements={minimapElements}
              stylesheet={stylesheet}
              layout={{ name: "preset" }}
              style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
              userZoomingEnabled={false}
              userPanningEnabled={false}
              autoungrabify
              cy={onCyMiniInit}
              aria-hidden="true"
            />
            <button
              onClick={open}
              className="absolute bottom-0 right-0 flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-muted/80 text-muted-foreground hover:bg-muted border-t border-l border-border rounded-tl-md transition-colors"
              aria-label="View argument graph fullscreen"
            >
              <ExpandIcon />
              Expand
            </button>
          </div>
          <ul className="sr-only" aria-label="Arguments shown in graph minimap (local context)">
            {minimapScreenReaderArgs.map((arg) => {
              const scheme = getSchemeById(arg.schemeId);
              const conclusion = scheme?.conclusion ?? "";
              const formal = renderArgumentText(
                conclusion,
                arg.variables.map((v) => ({ variableId: v.variableId, value: v.value })),
              );
              const summary = arg.argumentText?.trim() || formal;
              return (
                <li key={arg.id}>
                  {summary} — Status: {arg.status}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Fullscreen overlay — driven by graphStore.isFullscreen */}
      {isFullscreen &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 flex flex-col bg-background transition-all duration-300 ease-in-out sm:flex-row ${
              visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            <aside
              className={cn(
                "flex max-h-[45vh] shrink-0 flex-col border-b border-border bg-background sm:max-h-none sm:h-full sm:min-w-0 sm:border-b-0 sm:border-r",
                !isDesktopLayout && "w-full",
              )}
              style={
                isDesktopLayout ? { width: `${sidePanelFr * 100}vw`, flexShrink: 0 } : undefined
              }
              aria-label="Selected argument details"
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4 pt-14 sm:pt-6">
                {panelArgument == null ? (
                  <p className="text-sm text-muted-foreground">
                    Select an argument on the graph to see its details here.
                  </p>
                ) : (
                  <>
                    <ArgumentDetailBody
                      argument={panelArgument}
                      cqSubstitution={panelCqSubstitution}
                    />
                    <section
                      aria-labelledby="graph-children-heading"
                      className="mt-6 border-t border-border pt-5"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3
                          id="graph-children-heading"
                          className="text-sm font-semibold uppercase tracking-wide text-foreground sm:text-base"
                        >
                          Direct counter-arguments
                        </h3>
                        <ChildrenOutcomeStrip variant="emphasized" argument={panelArgument} />
                      </div>
                      {panelChildren.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None yet.</p>
                      ) : (
                        <div className="max-h-[min(40vh,16rem)] overflow-auto rounded-md border border-border">
                          <table className="w-full border-collapse text-left text-[11px] leading-snug">
                            <tbody>
                              {panelChildren.map((child) => (
                                <tr
                                  key={child.id}
                                  tabIndex={0}
                                  className={cn(
                                    "cursor-pointer border-b border-border last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                    child.id === selectedArgumentId && "bg-primary/10",
                                  )}
                                  onMouseEnter={() => setHoveredChildId(child.id)}
                                  onMouseLeave={() =>
                                    setHoveredChildId((cur) => (cur === child.id ? null : cur))
                                  }
                                  onClick={() => setPanelArgumentId(child.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setPanelArgumentId(child.id);
                                    }
                                  }}
                                >
                                  <td className="w-7 shrink-0 px-1 py-1.5 align-middle text-center">
                                    <span
                                      className={cn(
                                        "text-sm font-bold leading-none",
                                        STATUS_ROW_COLOR[child.status] ?? "text-muted-foreground",
                                      )}
                                      aria-label={`Status: ${child.status}`}
                                    >
                                      {STATUS_ROW_ICON[child.status] ?? "?"}
                                    </span>
                                  </td>
                                  <td className="max-w-0 px-2 py-1.5 align-middle text-foreground">
                                    <span className="line-clamp-3 break-words">
                                      {argumentTablePreview(child)}
                                    </span>
                                  </td>
                                  <td className="w-[1%] whitespace-nowrap px-2 py-1 align-middle">
                                    <ChildrenOutcomeStrip variant="compact" argument={child} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
              <div className="shrink-0 border-t border-border px-6 py-4">
                <Button
                  type="button"
                  className="w-full"
                  disabled={panelArgumentId == null}
                  onClick={goToArgumentFromPanel}
                >
                  Go to argument
                </Button>
              </div>
            </aside>
            {isDesktopLayout ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize argument panel"
                className="w-1.5 shrink-0 cursor-col-resize border-l border-r border-border bg-border/60 hover:bg-primary/40"
                onPointerDown={onSidePanelResizePointerDown}
              />
            ) : null}
            <div className="relative min-h-0 min-w-0 flex-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canFocusCurrentOnGraph}
                className="absolute left-4 top-4 z-20 h-9 gap-2 border border-border bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background"
                aria-label="Center graph on current argument"
                title="Center and zoom to the current argument"
                onClick={goToCurrentOnFullGraph}
              >
                <LocateFixed className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden font-medium sm:inline">Go to current</span>
              </Button>
              <CytoscapeComponent
                elements={elements}
                stylesheet={stylesheet}
                layout={{ name: "preset" }}
                style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
                userZoomingEnabled
                userPanningEnabled
                autoungrabify
                wheelSensitivity={GRAPH_FULLSCREEN_WHEEL_SENSITIVITY}
                cy={onCyFullInit}
              />
            </div>
            <button
              type="button"
              onClick={close}
              className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
              aria-label="Close expanded graph"
            >
              <CloseIcon />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
