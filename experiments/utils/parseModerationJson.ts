import type { ModerationResponse } from "../prompts/moderation/jsonContract.js";
import { moderationResponseSchema } from "../prompts/moderation/jsonContract.js";

export function parseModerationJson(
  raw: string,
): { ok: true; value: ModerationResponse } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = moderationResponseSchema.safeParse(data);
  if (!r.success) {
    return { ok: false, error: r.error.message };
  }
  return { ok: true, value: r.data };
}
