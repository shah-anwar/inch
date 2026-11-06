import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listModerationPromptNames,
  MODERATION_PROMPT_REGISTRY,
  type ModerationPromptName,
  type ModerationTestCaseInput,
} from "../prompts/moderation/index.js";
import type { ModerationResponse } from "../prompts/moderation/jsonContract.js";
import type { ModerationExperimentResultFile, ModerationRunRow } from "../types/moderationExperimentResults.js";
import { completeJson, type ChatMessage } from "../utils/mistralClient.js";
import { parseModerationJson } from "../utils/parseModerationJson.js";
import { resolveTokenUsage } from "../utils/tokenUsage.js";

// Moderation prompt experiment. Each variant in prompts/moderation/ is run once
// per hand-labelled case in data/moderationTestCases.json (gold pass/fail plus the
// offending variable ids). System message, temperature (0.1) and token cap (256)
// match the production call in backend/.../llm/moderation.ts, so the winning
// variant can be copied across unchanged. Per case it records the raw reply, the
// parsed verdict, token usage and API latency; moderationMetrics.ts turns these
// into precision/recall/F1. Output: results/moderation/<prompt>.json, which
// overwrites the committed result files. Mock mode works as in runExperiment.ts.

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");
const EXPERIMENTS_ROOT = join(__dirname, "..");
const RESULTS_DIR = join(EXPERIMENTS_ROOT, "results", "moderation");

const PARSE_FAIL_SNIPPET_LEN = 120;

config({ path: join(REPO_ROOT, "backend/.env") });
config({ path: join(REPO_ROOT, ".env") });

function loadTestCases(): ModerationTestCaseInput[] {
  const path = join(EXPERIMENTS_ROOT, "data/moderationTestCases.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ModerationTestCaseInput[];
}

function parseArgs(): { prompt: ModerationPromptName | "all" } {
  let prompt: ModerationPromptName | "all" = "all";
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--prompt=")) {
      const v = a.slice("--prompt=".length).trim();
      if (v === "all") {
        prompt = "all";
      } else if (listModerationPromptNames().includes(v as ModerationPromptName)) {
        prompt = v as ModerationPromptName;
      } else {
        console.error(`Unknown --prompt value: ${v}. Use: ${listModerationPromptNames().join(", ")}, all`);
        process.exit(1);
      }
    }
  }
  return { prompt };
}

function resolvePrompts(filter: ModerationPromptName | "all"): ModerationPromptName[] {
  if (filter === "all") return listModerationPromptNames();
  return [filter];
}

function logParseFail(promptName: string, testCaseId: string, rawOutput: string): void {
  const snippet =
    rawOutput.length <= PARSE_FAIL_SNIPPET_LEN
      ? rawOutput
      : `${rawOutput.slice(0, PARSE_FAIL_SNIPPET_LEN)}…`;
  console.error(`[parse-fail] prompt=${promptName} case=${testCaseId} raw=${snippet}`);
}

function computeCaseLabelCorrect(
  expected: "pass" | "fail",
  parsed: { passed: boolean } | null,
): boolean | null {
  if (parsed == null) return null;
  if (expected === "pass") return parsed.passed === true;
  return parsed.passed === false;
}

async function main() {
  const { prompt: promptFilter } = parseArgs();
  const testCases = loadTestCases();
  mkdirSync(RESULTS_DIR, { recursive: true });

  const model = process.env.MISTRAL_MODEL ?? "mistral-small-latest";
  const names = resolvePrompts(promptFilter);

  for (const promptName of names) {
    const def = MODERATION_PROMPT_REGISTRY[promptName];
    const startedAt = new Date().toISOString();
    const runs: ModerationRunRow[] = [];

    for (const tc of testCases) {
      const userContent = def.buildPrompt(tc);
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "You are a precise content moderator for structured argumentation scheme variables. Obey the JSON output contract exactly.",
        },
        { role: "user", content: userContent },
      ];

      const t0 = Date.now();
      const result = await completeJson(messages, {
        moderationMock: {
          expectedPass: tc.expectedResult === "pass",
          firstVariableId: tc.variables[0]?.variableId ?? "claim",
        },
        maxTokens: 256,
        temperature: 0.1,
      });
      const latencyMs = Date.now() - t0;

      const tokenUsage = resolveTokenUsage(messages, result.content, result);

      const parsedResult = parseModerationJson(result.content);
      let parseError: string | null = null;
      let parsed: ModerationResponse | null = null;
      if (parsedResult.ok) {
        parsed = parsedResult.value;
      } else {
        parseError = parsedResult.error;
        logParseFail(promptName, tc.id, result.content);
      }

      const caseLabelCorrect = computeCaseLabelCorrect(tc.expectedResult, parsed);

      runs.push({
        testCaseId: tc.id,
        schemeId: tc.schemeId,
        expectedResult: tc.expectedResult,
        expectedViolations: tc.expectedViolations,
        rawOutput: result.content,
        parsed,
        parseError,
        caseLabelCorrect,
        tokenUsage,
        latencyMs,
        mock: result.mock,
      });
    }

    const finishedAt = new Date().toISOString();
    const out: ModerationExperimentResultFile = {
      promptName,
      model,
      mock: runs[0]?.mock ?? false,
      runs,
      startedAt,
      finishedAt,
    };

    writeFileSync(join(RESULTS_DIR, `${promptName}.json`), JSON.stringify(out, null, 2), "utf8");
    console.log(`Wrote ${join("results", "moderation", `${promptName}.json`)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
