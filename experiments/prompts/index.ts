import { buildPrompt as buildMinimal } from "./minimal.js";
import { buildPrompt as buildWithDisambiguation } from "./withDisambiguation.js";
import { buildPrompt as buildTop2 } from "./top2.js";
import { buildPrompt as buildVerbose } from "./verbose.js";

export type PromptName = keyof typeof PROMPT_REGISTRY;

export const PROMPT_REGISTRY = {
  minimal: {
    buildPrompt: buildMinimal,
    parseMode: "single" as const,
  },
  withDisambiguation: {
    buildPrompt: buildWithDisambiguation,
    parseMode: "single" as const,
  },
  top2: {
    buildPrompt: buildTop2,
    parseMode: "top2" as const,
  },
  verbose: {
    buildPrompt: buildVerbose,
    parseMode: "single" as const,
  },
};

export function listPromptNames(): PromptName[] {
  return Object.keys(PROMPT_REGISTRY) as PromptName[];
}
