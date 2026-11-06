import type { ModerationResponse } from "../prompts/moderation/jsonContract.js";
import type { TokenUsage } from "./experimentResults.js";

export type ModerationRunRow = {
  testCaseId: string;
  schemeId: string;
  expectedResult: "pass" | "fail";
  expectedViolations?: string[];
  rawOutput: string;
  parsed: ModerationResponse | null;
  parseError: string | null;
  /** Case-level: prediction matches gold pass/fail (requires successful parse). */
  caseLabelCorrect: boolean | null;
  tokenUsage: TokenUsage;
  latencyMs: number;
  mock: boolean;
};

export type ModerationExperimentResultFile = {
  promptName: string;
  model: string | null;
  mock: boolean;
  runs: ModerationRunRow[];
  startedAt: string;
  finishedAt: string;
};

export type ModerationPromptSummaryMetrics = {
  precision: number;
  recall: number;
  f1: number;
  truePassRate: number;
  variableViolationAccuracy: number;
  parseFailureRate: number;
  avgTokensPerRequest: number;
  score: number;
  n: number;
};

export type ModerationSummaryFile = {
  generatedAt: string;
  prompts: Record<string, ModerationPromptSummaryMetrics>;
};
