/** Shared machine-readable contract for all variants (extended by `top2`). */
export const JSON_SINGLE = `Return a single JSON object only (no markdown fences), exactly this shape:
{"scheme":"<scheme_id>","ambiguity":"low"|"medium"|"high"}
Use only the listed scheme ids; use lowercase ambiguity.`;

export const JSON_TOP2 = `Return a single JSON object only (no markdown fences), exactly this shape:
{"scheme":"<primary_scheme_id>","secondaryScheme":"<runner_up_scheme_id>","ambiguity":"low"|"medium"|"high"}
Primary and secondary must be different ids from the list.`;
