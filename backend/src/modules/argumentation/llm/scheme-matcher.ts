import type { SchemeSuggestion, SuggestArgumentResponse } from "@inch/types";
import { z } from "zod";
import type { SchemeForSuggestion } from "../scheme.repository.js";
import { listSchemesForSuggestion } from "../scheme.repository.js";
import { callMistral } from "./mistral.js";

const MAX_SUGGESTIONS = 5;
const MAX_REASONING_LEN = 500;

const RawSuggestionSchema = z.object({
  schemeId: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
  prefillVariables: z.record(z.string(), z.string()).optional(),
});

const RawResponseSchema = z.object({
  suggestions: z.array(RawSuggestionSchema),
});

function variableIdsFromScheme(variables: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(variables)) return ids;
  for (const v of variables) {
    if (v && typeof v === "object" && "id" in v && typeof (v as { id: unknown }).id === "string") {
      ids.add((v as { id: string }).id);
    }
  }
  return ids;
}

function formatVariableIdList(variables: unknown): string {
  if (!Array.isArray(variables) || variables.length === 0) return "(none)";
  const ids: string[] = [];
  for (const v of variables) {
    if (v && typeof v === "object" && "id" in v && typeof (v as { id: unknown }).id === "string") {
      ids.push((v as { id: string }).id);
    }
  }
  return ids.length > 0 ? ids.join(", ") : "(none)";
}

function buildUserPrompt(text: string, schemes: SchemeForSuggestion[]): string {
  const allowedIds = schemes.map((s) => s.id).join(", ");
  const blocks = schemes.map((s) => {
    const vars = formatVariableIdList(s.variables);
    return `- \`${s.id}\` — **${s.name}**: ${s.description}\n  Variable ids for this scheme: ${vars}`;
  });

  return `The user describes an informal argument in natural language. Suggest up to ${MAX_SUGGESTIONS} Walton-style argumentation schemes from the list below that best match their intent (best match first).

Allowed scheme ids (use only these exact ids): ${allowedIds}

Schemes:

${blocks.join("\n\n")}

User text:
"""
${text.trim()}
"""

Return a single JSON object only (no markdown fences), exactly this shape:
{"suggestions":[{"schemeId":"<id from list>","confidence":"high"|"medium"|"low","reasoning":"<brief>","prefillVariables":{}}]}

Rules:
- Include only schemes that plausibly fit; rank closest matches first; fewer than ${MAX_SUGGESTIONS} entries is fine.
- \`prefillVariables\` maps each variable id (not display names) to a short string grounded in the user text; omit keys you cannot infer.
- If nothing matches well, return {"suggestions":[]}.`;
}

// Model output is untrusted. Prefill keys the scheme does not define are dropped
// and values are capped, so a suggestion can only ever fill real form fields.
function sanitizePrefill(
  raw: Record<string, string> | undefined,
  allowed: Set<string>,
): Record<string, string> {
  if (!raw || allowed.size === 0) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allowed.has(k)) continue;
    const s = typeof v === "string" ? v.trim() : String(v);
    if (s.length > 0) out[k] = s.length > 2000 ? s.slice(0, 2000) : s;
  }
  return out;
}

// Scheme ids are checked against the database set rather than trusted from the
// prompt, because the model can invent or repeat ids.
function mapToSuggestions(
  parsed: z.infer<typeof RawResponseSchema>,
  byId: Map<string, SchemeForSuggestion>,
): SchemeSuggestion[] {
  const seen = new Set<string>();
  const out: SchemeSuggestion[] = [];

  for (const row of parsed.suggestions) {
    if (out.length >= MAX_SUGGESTIONS) break;
    const scheme = byId.get(row.schemeId);
    if (!scheme) continue;
    if (seen.has(scheme.id)) continue;
    seen.add(scheme.id);

    let reasoning = row.reasoning.trim();
    if (reasoning.length > MAX_REASONING_LEN) {
      reasoning = reasoning.slice(0, MAX_REASONING_LEN);
    }

    const allowedVars = variableIdsFromScheme(scheme.variables);
    out.push({
      schemeId: scheme.id,
      schemeName: scheme.name,
      confidence: row.confidence,
      reasoning,
      prefillVariables: sanitizePrefill(row.prefillVariables, allowedVars),
    });
  }

  return out;
}

/**
 * Ranks argumentation schemes for free-text intent using Mistral and the current DB scheme set.
 * Suggestions are read-only; submission still validates against FR1/FR2.
 * Any failure (no key, request error, bad JSON, schema mismatch) returns an empty
 * list, so the user simply picks a scheme by hand.
 *
 * @param text User free-text (typically 10–500 chars from `POST /arguments/suggest`).
 */
export async function rankSchemesFromFreeText(text: string): Promise<SuggestArgumentResponse> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { suggestions: [] };
  }

  const schemes = await listSchemesForSuggestion();
  if (schemes.length === 0) {
    return { suggestions: [] };
  }

  const byId = new Map(schemes.map((s) => [s.id, s]));
  const userContent = buildUserPrompt(trimmed, schemes);

  const raw = await callMistral(
    [
      {
        role: "system",
        content:
          "You are a precise argumentation-scheme assistant. Output must be a single JSON object matching the user's requested shape exactly.",
      },
      { role: "user", content: userContent },
    ],
    {
      responseFormat: "json_object",
      temperature: 0.2,
      maxTokens: 1024,
    },
  );

  if (raw == null || raw.length === 0) {
    return { suggestions: [] };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    return { suggestions: [] };
  }

  const zResult = RawResponseSchema.safeParse(parsedJson);
  if (!zResult.success) {
    return { suggestions: [] };
  }

  return { suggestions: mapToSuggestions(zResult.data, byId) };
}
