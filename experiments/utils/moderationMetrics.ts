import type {
  ModerationExperimentResultFile,
  ModerationPromptSummaryMetrics,
} from "../types/moderationExperimentResults.js";
import { averageTotals, parseFailureRate, round4 } from "./metrics.js";

/**
 * Scores one moderation prompt variant against the gold labels.
 *
 * The positive class is "fail" (the input should be rejected), because catching
 * bad input is what the gate is for:
 *   - TP: gold fail, model fail. FP: gold pass, model fail. FN: gold fail, model pass.
 *   - An unparseable reply counts as a model pass, matching production, which fails open.
 *   - precision = TP / (TP + FP), recall = TP / (TP + FN), F1 = their harmonic mean.
 *     An empty denominator scores 1, since there was nothing to get wrong.
 *   - truePassRate: share of gold-pass cases the model passed, i.e. how rarely
 *     legitimate input gets blocked.
 *   - variableViolationAccuracy: share of expected offending variable ids the model
 *     named, over gold-fail cases it rejected.
 *   - score = F1 per 1,000 tokens (F1 / avgTokensPerRequest * 1000), used to rank
 *     variants on quality for cost.
 */
export function computeModerationPromptSummary(
  data: ModerationExperimentResultFile,
): ModerationPromptSummaryMetrics {
  const runs = data.runs;
  const n = runs.length;
  if (n === 0) {
    return {
      precision: 0,
      recall: 0,
      f1: 0,
      truePassRate: 0,
      variableViolationAccuracy: 0,
      parseFailureRate: 0,
      avgTokensPerRequest: 0,
      score: 0,
      n: 0,
    };
  }

  let tp = 0;
  let fp = 0;
  let fn = 0;

  let goldPassCount = 0;
  let correctPassCount = 0;

  let varHits = 0;
  let varExpected = 0;

  const parseFailures = runs.filter((r) => r.parseError != null).length;

  for (const r of runs) {
    const goldFail = r.expectedResult === "fail";
    const goldPass = r.expectedResult === "pass";
    if (goldPass) goldPassCount++;

    const parsed = r.parsed;
    const predFail = parsed != null && !parsed.passed;

    if (goldFail && predFail) tp++;
    else if (goldPass && predFail) fp++;
    else if (goldFail && !predFail) fn++;

    if (goldPass && parsed?.passed === true) correctPassCount++;

    const ev = r.expectedViolations;
    if (ev && ev.length > 0) {
      varExpected += ev.length;
      if (parsed && !parsed.passed) {
        const predIds = new Set(parsed.violations.map((v) => v.variableId));
        for (const id of ev) {
          if (predIds.has(id)) varHits++;
        }
      }
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const truePassRate = goldPassCount > 0 ? correctPassCount / goldPassCount : 0;
  const variableViolationAccuracy = varExpected > 0 ? varHits / varExpected : 1;

  const totals = runs.map((r) => r.tokenUsage.total);
  const avgTokensPerRequest = averageTotals(totals);
  const parseFailureRateVal = parseFailureRate(parseFailures, n);

  const score =
    avgTokensPerRequest > 0 ? round4((f1 / avgTokensPerRequest) * 1000) : 0;

  return {
    precision: round4(precision),
    recall: round4(recall),
    f1: round4(f1),
    truePassRate: round4(truePassRate),
    variableViolationAccuracy: round4(variableViolationAccuracy),
    parseFailureRate: round4(parseFailureRateVal),
    avgTokensPerRequest: round4(avgTokensPerRequest),
    score,
    n,
  };
}
