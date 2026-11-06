import {
  formatSchemeBulletsMinimal,
  formatSchemeListOneLine,
} from "../utils/schemeCatalog.js";
import { JSON_TOP2 } from "./jsonContract.js";

export function buildPrompt(input: string): string {
  const allowed = formatSchemeListOneLine();
  return `Rank the two most likely Walton-style argumentation schemes for the text (primary and runner-up).

Allowed scheme ids: ${allowed}

${formatSchemeBulletsMinimal()}

Text:
"""
${input.trim()}
"""

${JSON_TOP2}`;
}
