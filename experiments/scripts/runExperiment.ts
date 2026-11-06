import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExperimentRunRow } from "../types/experimentResults.js";
import { listPromptNames, PROMPT_REGISTRY, type PromptName } from "../prompts/index.js";
import { completeJson, type ChatMessage } from "../utils/mistralClient.js";
import { resolveTokenUsage } from "../utils/tokenUsage.js";
import {
  isAccuracyMatch,
  isTop2AccuracyMatch,
  parseClassificationJson,
  type ParsedClassification,
} from "../utils/validateResponse.js";

// Scheme-classification experiment. Each prompt variant in prompts/ is run once
// per labelled case in data/testCases.json, with the same system message, model,
// temperature (0.2) and token cap, so only the prompt text differs between variants.
// For every case it records the raw reply, the parsed result (or parse error),
// top-1/top-2 correctness, token usage and wall-clock latency of the API call.
// Cases run one at a time, so latency is not affected by local concurrency.
// Output: results/<prompt>.json per variant (gitignored); summarise.ts aggregates them.
// With EXPERIMENT_MOCK_MISTRAL=1 or no API key, replies are mocked from the gold
// label, which exercises the pipeline but says nothing about model quality.

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");
const EXPERIMENTS_ROOT = join(__dirname, "..");
const RESULTS_DIR = join(EXPERIMENTS_ROOT, "results");

const PARSE_FAIL_SNIPPET_LEN = 120;

config({ path: join(REPO_ROOT, "backend/.env") });
config({ path: join(REPO_ROOT, ".env") });

type TestCase = {
  id: string;
  input: string;
  expectedScheme: string;
};

function loadTestCases(): TestCase[] {
  const path = join(EXPERIMENTS_ROOT, "data/testCases.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as TestCase[];
}

function parseArgs(): { prompt: PromptName | "all" } {
  let prompt: PromptName | "all" = "all";
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--prompt=")) {
      const v = a.slice("--prompt=".length).trim();
      if (v === "all") {
        prompt = "all";
      } else if (listPromptNames().includes(v as PromptName)) {
        prompt = v as PromptName;
      } else {
        console.error(`Unknown --prompt value: ${v}. Use: ${listPromptNames().join(", ")}, all`);
        process.exit(1);
      }
    }
  }
  return { prompt };
}

function resolvePrompts(filter: PromptName | "all"): PromptName[] {
  if (filter === "all") return listPromptNames();
  return [filter];
}

function logParseFail(promptName: string, testCaseId: string, rawOutput: string): void {
  const snippet =
    rawOutput.length <= PARSE_FAIL_SNIPPET_LEN
      ? rawOutput
      : `${rawOutput.slice(0, PARSE_FAIL_SNIPPET_LEN)}…`;
  console.error(`[parse-fail] prompt=${promptName} case=${testCaseId} raw=${snippet}`);
}

async function main() {
  const { prompt: promptFilter } = parseArgs();
  const testCases = loadTestCases();
  mkdirSync(RESULTS_DIR, { recursive: true });

  const model = process.env.MISTRAL_MODEL ?? "mistral-small-latest";
  const names = resolvePrompts(promptFilter);

  for (const promptName of names) {
    const def = PROMPT_REGISTRY[promptName];
    const parseMode = def.parseMode;
    const startedAt = new Date().toISOString();
    const runs: ExperimentRunRow[] = [];

    for (const tc of testCases) {
      const userContent = def.buildPrompt(tc.input);
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "You are a precise argumentation-scheme classifier for research. Obey the JSON shape exactly.",
        },
        { role: "user", content: userContent },
      ];

      const t0 = Date.now();
      const result = await completeJson(messages, {
        mockExpectedScheme: tc.expectedScheme,
        mockSecondary: promptName === "top2",
        maxTokens: 512,
        temperature: 0.2,
      });
      const latencyMs = Date.now() - t0;

      const tokenUsage = resolveTokenUsage(messages, result.content, result);

      const parsedResult = parseClassificationJson(result.content, parseMode);
      let parseError: string | null = null;
      let parsed: ParsedClassification | null = null;
      if (parsedResult.ok) {
        parsed = parsedResult.value;
      } else {
        parseError = parsedResult.error;
        logParseFail(promptName, tc.id, result.content);
      }

      const accurate = parsed != null ? isAccuracyMatch(tc.expectedScheme, parsed) : false;

      let top2Accurate: boolean | null = null;
      if (parseMode === "top2") {
        top2Accurate = parsed != null ? isTop2AccuracyMatch(tc.expectedScheme, parsed) : false;
      }

      runs.push({
        testCaseId: tc.id,
        input: tc.input,
        expectedScheme: tc.expectedScheme,
        rawOutput: result.content,
        parsed,
        parseError,
        accurate,
        top2Accurate,
        tokenUsage,
        latencyMs,
        mock: result.mock,
      });
    }

    const finishedAt = new Date().toISOString();
    const out = {
      promptName,
      parseMode,
      model,
      mock: runs[0]?.mock ?? false,
      runs,
      startedAt,
      finishedAt,
    };

    writeFileSync(join(RESULTS_DIR, `${promptName}.json`), JSON.stringify(out, null, 2), "utf8");
    console.log(`Wrote ${join("results", `${promptName}.json`)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
