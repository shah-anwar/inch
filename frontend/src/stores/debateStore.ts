import { create } from "zustand";

// These types will eventually come from @inch/types once the
// Topic/Subtopic/Argument schemas are implemented.
// For now define minimal local types that match DATA_MODEL.md exactly.

interface Topic {
  id: number;
  title: string;
  description: string | null;
}

interface Subtopic {
  id: number;
  topicId: number;
  title: string;
}

interface DebateState {
  // Currently selected navigation items
  selectedTopic: Topic | null;
  selectedSubtopic: Subtopic | null;
  selectedArgumentId: string | null;

  // Actions
  selectTopic: (topic: Topic | null) => void;
  selectSubtopic: (subtopic: Subtopic | null) => void;
  selectArgument: (argumentId: string | null) => void;
  /** One store update for argument page breadcrumbs (avoids churn from three separate sets). */
  setArgumentPageBreadcrumb: (payload: {
    topic: Topic;
    subtopic: Subtopic;
    argumentId: string | null;
  }) => void;
  clearSelection: () => void;
}

/**
 * Global navigation context store for selected topic/subtopic/argument ids.
 */
export const useDebateStore = create<DebateState>((set) => ({
  selectedTopic: null,
  selectedSubtopic: null,
  selectedArgumentId: null,

  selectTopic: (topic) =>
    set({
      selectedTopic: topic,
      selectedSubtopic: null,
      selectedArgumentId: null,
    }),

  selectSubtopic: (subtopic) =>
    set({
      selectedSubtopic: subtopic,
      selectedArgumentId: null,
    }),

  selectArgument: (argumentId) => set({ selectedArgumentId: argumentId }),

  setArgumentPageBreadcrumb: ({ topic, subtopic, argumentId }) =>
    set({
      selectedTopic: topic,
      selectedSubtopic: subtopic,
      selectedArgumentId: argumentId,
    }),

  clearSelection: () =>
    set({
      selectedTopic: null,
      selectedSubtopic: null,
      selectedArgumentId: null,
    }),
}));
