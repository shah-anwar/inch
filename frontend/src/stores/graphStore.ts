import { create } from "zustand";

// Cytoscape layout algorithm options
type GraphLayout = "breadthfirst" | "circle" | "concentric" | "grid" | "cose";

interface GraphState {
  // View settings
  layout: GraphLayout;
  isFullscreen: boolean;
  showMinimap: boolean;

  // Interaction state
  highlightedNodeId: string | null;
  hoveredNodeId: string | null;

  // Actions
  setLayout: (layout: GraphLayout) => void;
  setFullscreen: (fullscreen: boolean) => void;
  toggleFullscreen: () => void;
  setShowMinimap: (show: boolean) => void;
  setHighlightedNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  resetView: () => void;
}

const defaultState = {
  layout: "breadthfirst" as GraphLayout,
  isFullscreen: false,
  showMinimap: true,
  highlightedNodeId: null,
  hoveredNodeId: null,
};

/**
 * Graph UI state store controlling layout mode, fullscreen/minimap toggles,
 * and node interaction highlights.
 */
export const useGraphStore = create<GraphState>((set) => ({
  ...defaultState,

  setLayout: (layout) => set({ layout }),

  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),

  setShowMinimap: (show) => set({ showMinimap: show }),

  setHighlightedNode: (nodeId) => set({ highlightedNodeId: nodeId }),

  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),

  resetView: () => set(defaultState),
}));
