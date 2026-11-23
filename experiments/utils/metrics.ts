import type {
  ConfusionMatrix,
  ExperimentResultFile,
  ExperimentRunRow,
  LegacyExperimentRunRow,
  OverallSummaryMetrics,
  ParseMode,
  PromptSummaryMetrics,
  TokenUsage,
} from "../types/experimentResults.js";
import { isTop2AccuracyMatch } from "./validateResponse.js";

// Metrics for the scheme-classification experiment (moderation metrics are in
// moderationMetrics.ts and reuse the helpers here).
//   - accuracy (top-1): share of cases whose primary predicted scheme is the gold scheme.
//   - top2Accuracy: share where the gold scheme is either of the two predictions
//     (only for the top2 prompt).
//   - parseFailureRate: share of replies that failed JSON/schema parsing; these
//     count as wrong for accuracy.
//   - score: accuracy divided by average total tokens per request, a cost-efficiency
//     ranking rather than a quality measure.
// Results files written before token usage was split into prompt/completion are
// normalised by `normalizeRunRow`.

const UNPARSED = "__unparsed__";

export function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function costEfficiencyScore(accuracy: number, avgTokensPerRequest: number): number {
  if (avgTokensPerRequest <= 0) return 0;
  return round4(accuracy / avgTokensPerRequest);
}

export function averageLatencyMs(latenciesMs: number[]): number {
  if (latenciesMs.length === 0) return 0;
  return latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length;
}

export function averageTotals(tokenTotals: number[]): number {
  if (tokenTotals.length === 0) return 0;
  return tokenTotals.reduce((a, b) => a + b, 0) / tokenTotals.length;
}

export function parseFailureRate(parseFailedCount: number, totalRuns: number): number {
  if (totalRuns === 0) return 0;
  return parseFailedCount / totalRuns;
}

export function top1Accuracy(hits: number, totalRuns: number): number {
  if (totalRuns === 0) return 0;
  return hits / totalRuns;
}

export function top2AccuracyRate(hits: number, totalRuns: number): number {
  if (totalRuns === 0) return 0;
  return hits / totalRuns;
}

/** Gold row → predicted column (primary scheme only); failed parses → `__unparsed__`. */
export function buildConfusionMatrix(
  rows: Array<{ expectedScheme: string; predictedPrimary: string | null }>,
): ConfusionMatrix {
  const m: ConfusionMatrix = {};
  for (const { expectedScheme, predictedPrimary } of rows) {
    const pred = predictedPrimary ?? UNPARSED;
    if (!m[expectedScheme]) m[expectedScheme] = {};
    const row = m[expectedScheme]!;
    row[pred] = (row[pred] ?? 0) + 1;
  }
  return m;
}

export function normalizeRunRow(
  r: LegacyExperimentRunRow | ExperimentRunRow,
  parseMode: ParseMode,
): ExperimentRunRow {
  let tokenUsage: TokenUsage;
  if (
    "tokenUsage" in r &&
    r.tokenUsage &&
    typeof r.tokenUsage.prompt === "number" &&
    typeof r.tokenUsage.completion === "number" &&
    typeof r.tokenUsage.total === "number"
  ) {
    tokenUsage = r.tokenUsage;
  } else if (typeof r.tokenCount === "number" && r.tokenCount != null) {
    tokenUsage = { prompt: 0, completion: 0, total: r.tokenCount };
  } else {
    tokenUsage = { prompt: 0, completion: 0, total: 0 };
  }

  let top2Accurate: boolean | null = null;
  if (parseMode === "top2") {
    top2Accurate =
      r.parsed != null && r.parseError == null
        ? isTop2AccuracyMatch(r.expectedScheme, r.parsed)
        : false;
  }

  return {
    testCaseId: r.testCaseId,
    input: r.input,
    expectedScheme: r.expectedScheme,
    rawOutput: r.rawOutput,
    parsed: r.parsed,
    parseError: r.parseError,
    accurate: r.accurate,
    top2Accurate,
    tokenUsage,
    latencyMs: r.latencyMs,
    mock: r.mock,
  };
}

export function computePromptSummary(data: ExperimentResultFile): PromptSummaryMetrics {
  const parseMode = data.parseMode;
  const runs = data.runs.map((row) => normalizeRunRow(row, parseMode));
  const n = runs.length;

  const parseFailures = runs.filter((r) => r.parseError != null).length;
  const parseFailureRateVal = parseFailureRate(parseFailures, n);

  const top1Hits = runs.filter((r) => r.accurate).length;
  const accuracyVal = top1Accuracy(top1Hits, n);

  let top2AccuracyVal: number | null = null;
  if (parseMode === "top2") {
    const t2Hits = runs.filter((r) => r.top2Accurate === true).length;
    top2AccuracyVal = top2AccuracyRate(t2Hits, n);
  }

  const confusionRows = runs.map((r) => ({
    expectedScheme: r.expectedScheme,
    predictedPrimary: r.parsed?.scheme ?? null,
  }));
  const confusionMatrix = buildConfusionMatrix(confusionRows);

  const latencies = runs.map((r) => r.latencyMs);
  const totals = runs.map((r) => r.tokenUsage.total);
  const avgLatencyMsVal = averageLatencyMs(latencies);
  const avgTokensPerRequestVal = averageTotals(totals);

  const scoreVal = costEfficiencyScore(accuracyVal, avgTokensPerRequestVal);

  return {
    accuracy: round4(accuracyVal),
    top2Accuracy: top2AccuracyVal == null ? null : round4(top2AccuracyVal),
    avgLatencyMs: round4(avgLatencyMsVal),
    avgTokensPerRequest: round4(avgTokensPerRequestVal),
    parseFailureRate: round4(parseFailureRateVal),
    score: scoreVal,
    n,
    confusionMatrix,
  };
}

export function computeOverall(
  prompts: Record<string, PromptSummaryMetrics>,
): OverallSummaryMetrics {
  const entries = Object.values(prompts);
  const totalRuns = entries.reduce((s, p) => s + p.n, 0);
  if (totalRuns === 0) {
    return {
      totalRuns: 0,
      weightedAccuracy: 0,
      weightedTop2Accuracy: null,
      weightedParseFailureRate: 0,
      avgAvgLatencyMs: 0,
      avgAvgTokensPerRequest: 0,
      avgScore: 0,
    };
  }

  let accW = 0;
  let parseW = 0;
  let latW = 0;
  let tokW = 0;
  let scoreW = 0;

  let top2W = 0;
  let top2Runs = 0;

  for (const p of entries) {
    accW += p.accuracy * p.n;
    parseW += p.parseFailureRate * p.n;
    latW += p.avgLatencyMs * p.n;
    tokW += p.avgTokensPerRequest * p.n;
    scoreW += p.score * p.n;
    if (p.top2Accuracy != null) {
      top2W += p.top2Accuracy * p.n;
      top2Runs += p.n;
    }
  }

  return {
    totalRuns,
    weightedAccuracy: round4(accW / totalRuns),
    weightedTop2Accuracy: top2Runs > 0 ? round4(top2W / top2Runs) : null,
    weightedParseFailureRate: round4(parseW / totalRuns),
    avgAvgLatencyMs: round4(latW / totalRuns),
    avgAvgTokensPerRequest: round4(tokW / totalRuns),
    avgScore: round4(scoreW / totalRuns),
  };
}
