import type { GenerateArgumentTextRequest } from "@inch/types";
import { init } from "@paralleldrive/cuid2";
import { getRedisClient } from "../../../cache/redis.js";

// One-time store for generated text options. Arguments are stored with text the
// user picked from server-generated options, never free text the client sends
// (FR1). The token binds the options to one user and to the exact scheme and
// variables they were generated for, so a client cannot swap in other text or
// reuse options after editing the inputs. Redis is used when configured;
// otherwise an in-process map is used, which only works for a single instance.

const createId = init({ length: 32 });
const PREVIEW_TTL_SECONDS = 10 * 60;
const PREVIEW_KEY_PREFIX = "argument-text-preview:";

export type TextPreview = {
  request: GenerateArgumentTextRequest;
  requestSignature: string;
  options: Record<string, string>;
  userId: string;
  createdAt: number;
};

const memoryStore = new Map<
  string,
  {
    expiresAt: number;
    payload: TextPreview;
  }
>();

/** Normalises variable rows for hashing (trim values, stable sort by id). */
function normaliseVariablesForSignature(
  variables: { variableId: string; value: string }[],
): { variableId: string; value: string }[] {
  return variables
    .map((variable) => ({
      variableId: variable.variableId,
      value: variable.value.trim(),
    }))
    .sort((a, b) => a.variableId.localeCompare(b.variableId));
}

/**
 * Builds deterministic request signature for preview-token validation.
 * Uses explicit key order so client JSON parse order cannot diverge from server-built payloads.
 */
function buildRequestSignature(request: GenerateArgumentTextRequest): string {
  const variables = normaliseVariablesForSignature(request.variables);
  if (request.kind === "initial") {
    return JSON.stringify({
      kind: "initial",
      schemeId: request.schemeId,
      subtopicId: request.subtopicId,
      variables,
    });
  }
  return JSON.stringify({
    kind: "counter",
    schemeId: request.schemeId,
    parentArgumentId: request.parentArgumentId,
    selectedCqId: request.selectedCqId,
    variables,
  });
}

/**
 * Stores preview context and option texts for later submission verification.
 *
 * @param request Structured generation request payload.
 * @param options Map of opaque option id to full text (server-side only).
 * @param userId Authenticated user id this preview is bound to.
 * @returns One-time preview token.
 */
export async function storeTextPreview(
  request: GenerateArgumentTextRequest,
  options: Record<string, string>,
  userId: string,
): Promise<string> {
  const token = createId();
  const requestSignature = buildRequestSignature(request);
  const payload: TextPreview = {
    request,
    requestSignature,
    options,
    userId,
    createdAt: Date.now(),
  };
  const redis = getRedisClient();

  if (redis) {
    await redis.set(
      `${PREVIEW_KEY_PREFIX}${token}`,
      JSON.stringify(payload),
      "EX",
      PREVIEW_TTL_SECONDS,
    );
    return token;
  }

  memoryStore.set(token, {
    expiresAt: Date.now() + PREVIEW_TTL_SECONDS * 1000,
    payload,
  });
  return token;
}

/**
 * Validates preview token, user binding, request signature, and selected option,
 * then consumes the preview token.
 *
 * @param params Validation payload from argument submission.
 * @returns Authoritative argument text for persistence.
 * @throws {Error} When token is expired, mismatched, or option is invalid.
 */
export async function validateAndConsumeTextPreview(params: {
  token: string;
  request: GenerateArgumentTextRequest;
  selectedOptionId: string;
  userId: string;
}): Promise<string> {
  const preview = await readTextPreview(params.token);

  if (!preview) {
    throw new Error("Preview token is invalid or expired.");
  }

  if (preview.userId !== params.userId) {
    throw new Error("Preview does not belong to this user.");
  }

  const storedSignature = preview.requestSignature;
  const currentSignature = buildRequestSignature(params.request);

  if (storedSignature !== currentSignature) {
    await deleteTextPreview(params.token);
    throw new Error("Request mismatch for preview.");
  }

  const text = preview.options[params.selectedOptionId];

  if (!text) {
    throw new Error("Invalid option selected.");
  }

  await deleteTextPreview(params.token);

  return text;
}

async function readTextPreview(token: string): Promise<TextPreview | null> {
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(`${PREVIEW_KEY_PREFIX}${token}`);
    if (!raw) return null;
    return JSON.parse(raw) as TextPreview;
  }

  const entry = memoryStore.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(token);
    return null;
  }
  return entry.payload;
}

async function deleteTextPreview(token: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.del(`${PREVIEW_KEY_PREFIX}${token}`);
    return;
  }

  memoryStore.delete(token);
}

/**
 * Explicitly releases an unused preview token.
 *
 * @param token Preview token.
 * @param userId Authenticated user id (must match stored preview).
 * @returns Promise resolved after deletion.
 */
export async function releaseTextPreview(token: string, userId: string): Promise<void> {
  const preview = await readTextPreview(token);
  if (!preview) return;
  if (preview.userId !== userId) {
    throw new Error("Preview does not belong to this user.");
  }
  await deleteTextPreview(token);
}
