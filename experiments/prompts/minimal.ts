import {
  formatSchemeBulletsMinimal,
  formatSchemeListOneLine,
} from "../utils/schemeCatalog.js";
import { JSON_SINGLE } from "./jsonContract.js";

export function buildPrompt(input: string): string {
  const allowed = formatSchemeListOneLine();
  return `Classify the following text into one Walton-style argumentation scheme.

Allowed scheme ids: ${allowed}

${formatSchemeBulletsMinimal()}

Text:
"""
${input.trim()}
"""

${JSON_SINGLE}`;
}
