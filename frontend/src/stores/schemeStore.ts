import { create } from "zustand";

// These types mirror the Scheme and CriticalQuestion types from @inch/types.
// Once @inch/types exports these, replace these local definitions with imports.

interface SchemeVariable {
  id: string;
  name: string;
  description: string;
  placeholder: string;
  required: boolean;
  type: "string" | "entity" | "claim";
}

interface CriticalQuestion {
  id: string;
  text: string;
  description: string;
  validResponseSchemeIds: string[];
}

interface Scheme {
  id: string;
  name: string;
  description: string;
  conclusion: string;
  variables: SchemeVariable[];
  criticalQuestions: CriticalQuestion[];
}

interface SchemeState {
  schemes: Scheme[];
  isLoaded: boolean;
  error: string | null;

  // Actions
  setSchemes: (schemes: Scheme[]) => void;
  setError: (error: string | null) => void;
  getSchemeById: (id: string) => Scheme | undefined;
  getCriticalQuestion: (schemeId: string, cqId: string) => CriticalQuestion | undefined;
  getValidResponseSchemes: (schemeId: string, cqId: string) => Scheme[];
}

/**
 * Scheme registry store used by argument drawers for scheme/CQ lookups.
 */
export const useSchemeStore = create<SchemeState>((set, get) => ({
  schemes: [],
  isLoaded: false,
  error: null,

  setSchemes: (schemes) => set({ schemes, isLoaded: true, error: null }),

  setError: (error) => set({ error, isLoaded: false }),

  getSchemeById: (id) => get().schemes.find((s) => s.id === id),

  getCriticalQuestion: (schemeId, cqId) =>
    get()
      .schemes.find((s) => s.id === schemeId)
      ?.criticalQuestions.find((cq) => cq.id === cqId),

  getValidResponseSchemes: (schemeId, cqId) => {
    const state = get();
    const cq = state.getCriticalQuestion(schemeId, cqId);
    if (!cq) return [];
    if (cq.validResponseSchemeIds.length === 0) return state.schemes;
    return state.schemes.filter((s) => cq.validResponseSchemeIds.includes(s.id));
  },
}));
