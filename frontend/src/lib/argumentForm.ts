import { z } from "zod";

const PLACEHOLDER_START = "\u0001CQ:";
const PLACEHOLDER_END = "\u0001";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract short symbol from variable name, e.g. "Expert (E)" -> "E", "First Step (A₀)" -> "A₀". */
function symbolFromVariableName(name: string): string | null {
  const m = name.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

/** Segment representation for CQ text with interpolated variable-value chips. */
export type CqSegment =
  | { type: "text"; content: string }
  | { type: "value"; value: string; symbol: string };

/**
 * Splits critical question text into text and value segments by substituting
 * argument variable values for their symbols (e.g. E, A, G from variable names).
 * Symbols are matched as backticked `X` or as a standalone token (word boundary).
 */
export function getCriticalQuestionSegments(
  cqText: string,
  schemeVariables: { id: string; name: string }[],
  variableValues: { variableId: string; value: string }[],
): CqSegment[] {
  const valueByVarId = new Map(variableValues.map((v) => [v.variableId, v.value]));
  const symbolAliasToVarId = new Map<string, string>();
  const varIdToSymbol = new Map<string, string>();
  for (const v of schemeVariables) {
    const symbol = symbolFromVariableName(v.name);
    if (symbol) {
      symbolAliasToVarId.set(symbol, v.id);
      symbolAliasToVarId.set(symbol.toLowerCase(), v.id);
      varIdToSymbol.set(v.id, symbol);
    }
  }
  const symbolsByLength = [...symbolAliasToVarId.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );

  let result = cqText;
  for (const [symbol, varId] of symbolsByLength) {
    const value = valueByVarId.get(varId);
    if (value === undefined) continue;
    const esc = escapeRegex(symbol);
    const placeholder = `${PLACEHOLDER_START}${varId}${PLACEHOLDER_END}`;
    // Backticked form: `symbol` → placeholder
    result = result.replace(new RegExp(`\`${esc}\``, "g"), placeholder);
    // Word-boundary form: keep surrounding spaces
    result = result.replace(
      new RegExp(`(^|[\\s(\\[])${esc}($|[\\s)\\].,;:!?])`, "g"),
      (_, before: string, after: string) => before + placeholder + after,
    );
  }

  const splitRegex = new RegExp(
    `${escapeRegex(PLACEHOLDER_START)}([^\\u0001]*)${escapeRegex(PLACEHOLDER_END)}`,
    "g",
  );
  const parts: string[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = splitRegex.exec(result)) !== null) {
    parts.push(result.slice(lastIndex, m.index));
    parts.push(m[1]!);
    lastIndex = splitRegex.lastIndex;
  }
  parts.push(result.slice(lastIndex));

  const segments: CqSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].length > 0) segments.push({ type: "text", content: parts[i] });
    } else {
      const varId = parts[i]!;
      const value = valueByVarId.get(varId);
      const symbol = varIdToSymbol.get(varId);
      if (value !== undefined && symbol !== undefined)
        segments.push({ type: "value", value, symbol });
    }
  }
  return segments;
}

/**
 * Builds a Zod schema for dynamic scheme variables.
 *
 * @param variables Variable definitions with required flags.
 * @returns Zod object schema keyed by variable id for react-hook-form validation.
 */
export function buildVariableSchema(
  variables: { id: string; required: boolean }[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const v of variables) {
    shape[v.id] = v.required ? z.string().min(1, "This field is required") : z.string().optional();
  }
  return z.object(shape);
}

/**
 * Renders a human-readable conclusion template preview using variable names.
 *
 * @param conclusion Scheme conclusion template containing `{variableId}` placeholders.
 * @param variableNames Variable metadata used to replace placeholder ids.
 * @returns Preview text where placeholders are replaced with bracketed variable names.
 */
export function conclusionPreview(
  conclusion: string,
  variableNames: { id: string; name: string }[],
): string {
  const byId = new Map(variableNames.map((v) => [v.id, v.name]));
  return conclusion.replace(/\{(\w+)\}/g, (_match, id: string) =>
    byId.has(id) ? `[${byId.get(id)}]` : `{${id}}`,
  );
}
