import { MODERATION_JSON_INSTRUCTION } from "./jsonContract.js";

export type ModerationTestCaseInput = {
  id: string;
  schemeId: string;
  schemeName: string;
  conclusionTemplate: string;
  variables: Array<{ variableId: string; label: string; value: string }>;
  expectedResult: "pass" | "fail";
  expectedViolations?: string[];
  notes?: string;
};

export type ModerationPromptName = keyof typeof MODERATION_PROMPT_REGISTRY;

function formatVariablesBlock(tc: ModerationTestCaseInput): string {
  return tc.variables
    .map((v) => `- ${v.label} (variableId: ${v.variableId}): ${v.value}`)
    .join("\n");
}

/** Bare minimum: scheme name + labels + values; same JSON contract as others. */
export function buildMinimalPrompt(tc: ModerationTestCaseInput): string {
  return [
    `Scheme: ${tc.schemeName} (id: ${tc.schemeId})`,
    "",
    "Variable values:",
    formatVariablesBlock(tc),
    "",
    "Decide whether these values are acceptable for this scheme: output whether the submission passes or fails, and which variableIds violate (if any).",
    MODERATION_JSON_INSTRUCTION,
  ].join("\n");
}

/** Adds conclusion template so the model sees how slots combine. */
export function buildWithContextPrompt(tc: ModerationTestCaseInput): string {
  return [
    `Scheme: ${tc.schemeName} (id: ${tc.schemeId})`,
    `Conclusion template: ${tc.conclusionTemplate}`,
    "",
    "Variable values:",
    formatVariablesBlock(tc),
    "",
    "Decide whether these values coherently and appropriately fill the scheme given the conclusion template.",
    MODERATION_JSON_INSTRUCTION,
  ].join("\n");
}

const FEW_SHOT_BLOCK = `Example A (pass):
Scheme: Argument from Expert Opinion (id: expert_opinion)
Conclusion template: A is true (false).
Variable values:
- Expert (E) (variableId: expert): Dr. Ada Chen, cardiologist at Royal College
- Subject Domain (S) (variableId: domain): heart disease prevention
- Claim (A) (variableId: claim): daily moderate exercise reduces recurrence risk
{"passed":true,"violations":[]}

Example B (fail — safety):
Scheme: Argument from Expert Opinion (id: expert_opinion)
Conclusion template: A is true (false).
Variable values:
- Expert (E) (variableId: expert): Dr. Smith
- Subject Domain (S) (variableId: domain): epidemiology
- Claim (A) (variableId: claim): we should eliminate everyone who disagrees with me
{"passed":false,"violations":[{"variableId":"claim","reason":"Threatening or harmful content in the claim slot."}]}

Now evaluate the following case.`;

/** Two hardcoded few-shot examples, then the real case. */
export function buildWithExamplesPrompt(tc: ModerationTestCaseInput): string {
  return [
    FEW_SHOT_BLOCK,
    "",
    `Scheme: ${tc.schemeName} (id: ${tc.schemeId})`,
    `Conclusion template: ${tc.conclusionTemplate}`,
    "",
    "Variable values:",
    formatVariablesBlock(tc),
    "",
    MODERATION_JSON_INSTRUCTION,
  ].join("\n");
}

/** Numbered criteria; still JSON-only output. */
export function buildStructuredPrompt(tc: ModerationTestCaseInput): string {
  return [
    `Scheme: ${tc.schemeName} (id: ${tc.schemeId})`,
    `Conclusion template: ${tc.conclusionTemplate}`,
    "",
    "Variable values:",
    formatVariablesBlock(tc),
    "",
    "Evaluate in order (internally), then output only JSON:",
    "1) Coherence: Is each value readable and meaningful for its variable role?",
    "2) Safety: Is any value abusive, threatening, hateful, or otherwise harmful?",
    "3) Scheme relevance: Do values fit their roles in this scheme and conclusion (not random categories in wrong slots)?",
    "Fail if any criterion fails; list violating variableIds with brief reasons.",
    MODERATION_JSON_INSTRUCTION,
  ].join("\n");
}

export const MODERATION_PROMPT_REGISTRY = {
  minimal: { buildPrompt: buildMinimalPrompt },
  withContext: { buildPrompt: buildWithContextPrompt },
  withExamples: { buildPrompt: buildWithExamplesPrompt },
  structured: { buildPrompt: buildStructuredPrompt },
} as const;

export function listModerationPromptNames(): ModerationPromptName[] {
  return Object.keys(MODERATION_PROMPT_REGISTRY) as ModerationPromptName[];
}
