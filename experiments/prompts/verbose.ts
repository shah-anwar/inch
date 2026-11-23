import {
  formatSchemeBulletsVerbose,
  formatSchemeListOneLine,
  schemeCount,
  criticalQuestionCount,
} from "../utils/schemeCatalog.js";
import { JSON_SINGLE } from "./jsonContract.js";

export function buildPrompt(input: string): string {
  const allowed = formatSchemeListOneLine();
  return `You label informal argumentative text with one Walton-style scheme id from the project's active ontology (seeded in the DB from shared/types).

Allowed scheme ids: ${allowed}

Full scheme reference (${schemeCount()} schemes, ${criticalQuestionCount()} critical questions in DB; sample CQs per scheme):

${formatSchemeBulletsVerbose()}

Text to classify:
"""
${input.trim()}
"""

${JSON_SINGLE}`;
}
