import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExperimentResultFile, SummaryFile } from "../types/experimentResults.js";
import { computeOverall, computePromptSummary } from "../utils/metrics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "../results");

function loadResultFile(path: string): ExperimentResultFile {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ExperimentResultFile;
}

function main() {
  const files = readdirSync(RESULTS_DIR).filter(
    (f) => f.endsWith(".json") && f !== "summary.json",
  );

  const prompts: SummaryFile["prompts"] = {};

  for (const f of files) {
    const data = loadResultFile(join(RESULTS_DIR, f));
    prompts[data.promptName] = computePromptSummary(data);
  }

  const summary: SummaryFile = {
    generatedAt: new Date().toISOString(),
    prompts,
    overall: computeOverall(prompts),
  };

  writeFileSync(join(RESULTS_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`Wrote ${join("results", "summary.json")}`);
}

main();
