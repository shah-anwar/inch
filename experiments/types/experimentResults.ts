import type { ParsedClassification } from "../utils/validateResponse.js";

/** Token accounting for one LLM call (API or estimated). */
export type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
};

/** One row in an experiment result file (`results/{promptName}.json`). */
export type ExperimentRunRow = {
  testCaseId: string;
  input: string;
  expectedScheme: string;
  rawOutput: string;
  parsed: ParsedClassification | null;
  parseError: string | null;
  /** Top-1: primary scheme matches gold. */
  accurate: boolean;
  /** Only for `parseMode === "top2"`: gold in {scheme, secondaryScheme}. Omitted or null for single-label files. */
  top2Accurate: boolean | null;
  tokenUsage: TokenUsage;
  latencyMs: number;
  mock: boolean;
};

/** Legacy shape before tokenUsage (summarise may upgrade). */
export type LegacyExperimentRunRow = Omit<ExperimentRunRow, "tokenUsage" | "top2Accurate"> & {
  tokenCount?: number | null;
  tokenUsage?: TokenUsage;
  top2Accurate?: boolean | null;
};

export type ParseMode = "single" | "top2";

/** Written by `runExperiment.ts`. */
export type ExperimentResultFile = {
  promptName: string;
  parseMode: ParseMode;
  model: string | null;
  mock: boolean;
  runs: ExperimentRunRow[] | LegacyExperimentRunRow[];
  startedAt: string;
  finishedAt: string;
};

/** Per-prompt block in `summary.json`. */
export type PromptSummaryMetrics = {
  accuracy: number;
  top2Accuracy: number | null;
  avgLatencyMs: number;
  avgTokensPerRequest: number;
  parseFailureRate: number;
  score: number;
  n: number;
  confusionMatrix: ConfusionMatrix;
};

export type ConfusionMatrix = Record<string, Record<string, number>>;

/** Root `summary.json`. */
export type SummaryFile = {
  generatedAt: string;
  prompts: Record<string, PromptSummaryMetrics>;
  overall: OverallSummaryMetrics;
};

export type OverallSummaryMetrics = {
  totalRuns: number;
  weightedAccuracy: number;
  weightedTop2Accuracy: number | null;
  weightedParseFailureRate: number;
  avgAvgLatencyMs: number;
  avgAvgTokensPerRequest: number;
  avgScore: number;
};
