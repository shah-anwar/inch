import { z } from "zod";
import { ACTIVE_SCHEME_IDS } from "./schemeCatalog.js";

const ambiguity = z.enum(["low", "medium", "high"]);

function schemeEnum() {
  const ids = ACTIVE_SCHEME_IDS as unknown as [string, ...string[]];
  return z.enum(ids);
}

const baseSchema = z.object({
  scheme: schemeEnum(),
  ambiguity,
});

const top2Schema = z.object({
  scheme: schemeEnum(),
  secondaryScheme: schemeEnum(),
  ambiguity,
});

export type ParsedClassification = z.infer<typeof baseSchema> & {
  secondaryScheme?: string;
};

export function parseClassificationJson(
  raw: string,
  mode: "single" | "top2",
): { ok: true; value: ParsedClassification } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
  const schema = mode === "top2" ? top2Schema : baseSchema;
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  const v = result.data;
  if (mode === "top2" && v.scheme === v.secondaryScheme) {
    return { ok: false, error: "scheme and secondaryScheme must differ" };
  }
  return { ok: true, value: v as ParsedClassification };
}

/** Primary label must match the gold scheme id. */
export function isAccuracyMatch(expected: string, parsed: ParsedClassification): boolean {
  return parsed.scheme === expected;
}

/** For top-2 mode: correct if gold equals primary or secondary label. */
export function isTop2AccuracyMatch(expected: string, parsed: ParsedClassification): boolean {
  if (parsed.scheme === expected) return true;
  return parsed.secondaryScheme === expected;
}
