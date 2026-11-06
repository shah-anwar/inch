import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ModerationExperimentResultFile,
  ModerationSummaryFile,
} from "../types/moderationExperimentResults.js";
import { computeModerationPromptSummary } from "../utils/moderationMetrics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "../results/moderation");

function loadResultFile(path: string): ModerationExperimentResultFile {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ModerationExperimentResultFile;
}

function main() {
  const files = readdirSync(RESULTS_DIR).filter(
    (f) => f.endsWith(".json") && f !== "summary.json",
  );

  const prompts: ModerationSummaryFile["prompts"] = {};

  for (const f of files) {
    const data = loadResultFile(join(RESULTS_DIR, f));
    prompts[data.promptName] = computeModerationPromptSummary(data);
  }

  const summary: ModerationSummaryFile = {
    generatedAt: new Date().toISOString(),
    prompts,
  };

  writeFileSync(join(RESULTS_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`Wrote ${join("results", "moderation", "summary.json")}`);

  const rows = Object.entries(prompts)
    .map(([name, m]) => ({ name, ...m }))
    .sort((a, b) => b.score - a.score);

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);

  const wName = 14;
  const wNum = 11;
  console.log("");
  console.log(
    [
      col("prompt", wName),
      col("F1", wNum),
      col("precision", wNum),
      col("recall", wNum),
      col("truePassRt", wNum),
      col("parseFail", wNum),
      col("avgTok", wNum),
      col("score", wNum),
    ].join("  "),
  );
  console.log("-".repeat(wName + wNum * 7 + 18));
  for (const r of rows) {
    console.log(
      [
        col(r.name, wName),
        col(String(r.f1), wNum),
        col(String(r.precision), wNum),
        col(String(r.recall), wNum),
        col(String(r.truePassRate), wNum),
        col(String(r.parseFailureRate), wNum),
        col(String(r.avgTokensPerRequest), wNum),
        col(String(r.score), wNum),
      ].join("  "),
    );
  }
  console.log("");
}

main();
