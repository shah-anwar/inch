import { getCriticalQuestion, getSchemeById, renderArgumentText } from "@inch/types";
import type { GenerateArgumentTextRequest, GenerateArgumentTextResponse } from "@inch/types";
import { init } from "@paralleldrive/cuid2";
import { getArgumentById } from "../argument.repository.js";
import { callMistral } from "./mistral.js";
import { storeTextPreview } from "./text-preview-store.js";

const createOptionId = init({ length: 24 });

/** Normalizes whitespace for deterministic variation comparison and storage. */
function normaliseVariation(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Gives each text option an opaque random id. The client submits the id, not the
 * text, so the server can confirm the chosen wording was one it generated.
 */
function assignOptionIds(texts: string[]): {
  options: Array<{ id: string; text: string }>;
  record: Record<string, string>;
} {
  const options: Array<{ id: string; text: string }> = [];
  const record: Record<string, string> = {};
  for (const text of texts) {
    const id = createOptionId();
    options.push({ id, text });
    record[id] = text;
  }
  return { options, record };
}

/**
 * Deduplicates candidate text variants case-insensitively after normalization.
 *
 * @param values Candidate variation list.
 * @returns Unique non-empty variations preserving first-seen order.
 */
function dedupeVariations(values: string[]): string[] {
  const unique: string[] = [];
  for (const value of values) {
    const normalised = normaliseVariation(value);
    if (!normalised) continue;
    if (!unique.some((existing) => existing.toLowerCase() === normalised.toLowerCase())) {
      unique.push(normalised);
    }
  }
  return unique;
}

/**
 * Generates deterministic fallback variants used when model output is missing or invalid.
 *
 * @param fallback Structured base argument text.
 * @param parentArgumentText Optional parent text for counter-argument framing.
 * @returns Three fallback phrasings with equivalent semantics.
 */
function buildFallbackVariations(fallback: string, parentArgumentText?: string | null): string[] {
  const base = normaliseVariation(fallback);
  if (!parentArgumentText) {
    return [
      base,
      `The point being made is that ${base.charAt(0).toLowerCase()}${base.slice(1)}`,
      `In neutral terms, ${base.charAt(0).toLowerCase()}${base.slice(1)}`,
    ];
  }

  const parent = normaliseVariation(parentArgumentText);
  return [
    `In response to "${parent}", ${base.charAt(0).toLowerCase()}${base.slice(1)}`,
    `That reply can be stated as follows: ${base.charAt(0).toLowerCase()}${base.slice(1)}`,
    `A direct answer to "${parent}" is that ${base.charAt(0).toLowerCase()}${base.slice(1)}`,
  ];
}

/**
 * Builds LLM prompt context for either initial-argument or counter-argument text generation.
 *
 * @param request Structured preview request payload.
 * @returns Prompt context, fallback text, and resolved scheme metadata.
 * @throws {Error} When referenced scheme or parent argument cannot be resolved.
 */
async function buildPromptContext(request: GenerateArgumentTextRequest) {
  const scheme = getSchemeById(request.schemeId);
  if (!scheme) {
    throw new Error(`Unknown scheme: ${request.schemeId}`);
  }

  const structuredText = renderArgumentText(scheme.conclusion, request.variables);
  const variablesDescription = request.variables
    .map((variable) => {
      const variableDef = scheme.variables.find((item) => item.id === variable.variableId);
      return `${variableDef?.name ?? variable.variableId}: ${variable.value}`;
    })
    .join("\n");

  if (request.kind === "initial") {
    return {
      scheme,
      structuredText,
      userPrompt: [
        "Create exactly three different neutral natural-language versions of this structured argument.",
        "Keep all versions factual, calm, and emotionally flat.",
        "Do not add claims, evidence, or evaluation.",
        "Each version must preserve the same meaning while varying sentence structure.",
        "",
        `Scheme: ${scheme.name}`,
        `Structured argument: ${structuredText}`,
        "Variables:",
        variablesDescription || "None provided.",
      ].join("\n"),
      fallbackVariations: buildFallbackVariations(structuredText),
    };
  }

  const parentArgument = await getArgumentById(request.parentArgumentId);
  if (!parentArgument) {
    throw new Error("Parent argument not found");
  }

  const parentScheme = getSchemeById(parentArgument.schemeId);
  const parentStructured = parentScheme
    ? renderArgumentText(
        parentScheme.conclusion,
        parentArgument.variables.map((variable) => ({
          variableId: variable.variableId,
          value: variable.value,
        })),
      )
    : "";
  const parentArgumentText = parentArgument.argumentText || parentStructured;
  const criticalQuestion = getCriticalQuestion(parentArgument.schemeId, request.selectedCqId);

  return {
    scheme,
    structuredText,
    userPrompt: [
      "Create exactly three different neutral natural-language counter-arguments.",
      "Each version must read like a direct reply to the attacked argument.",
      "Keep the tone factual, emotionally flat, and free of rhetorical flourish.",
      "Do not add new claims beyond the supplied structure.",
      "",
      `Parent argument text: ${parentArgumentText}`,
      criticalQuestion ? `Critical question raised: ${criticalQuestion.text}` : null,
      `Response scheme: ${scheme.name}`,
      `Structured counter-argument: ${structuredText}`,
      "Variables:",
      variablesDescription || "None provided.",
    ]
      .filter((line): line is string => line != null)
      .join("\n"),
    fallbackVariations: buildFallbackVariations(structuredText, parentArgumentText),
  };
}

/**
 * Produces three user-selectable neutral natural-language variants for a structured argument.
 *
 * Side effects:
 * - Calls Mistral API.
 * - Stores generated options in preview cache and returns a preview token.
 *
 * @param request Structured argument payload for either initial or counter flow.
 * @param userId Authenticated user id; preview is bound to this user.
 * @returns Preview token plus exactly three text options and structured fallback text.
 */
export async function generateArgumentTextVariations(
  request: GenerateArgumentTextRequest,
  userId: string,
): Promise<GenerateArgumentTextResponse> {
  const { structuredText, userPrompt, fallbackVariations } = await buildPromptContext(request);

  const systemPrompt = [
    "You rewrite structured arguments into natural-language text.",
    "Return JSON only with this shape:",
    '{ "variations": ["...", "...", "..."] }',
    "Produce exactly three distinct alternatives.",
    "Keep them neutral, concise, and semantically faithful.",
    "Do not use emotional language, exaggeration, or evaluation.",
  ].join("\n");

  const content = await callMistral(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 500, temperature: 0.5, responseFormat: "json_object" },
  );

  const fallback = dedupeVariations(fallbackVariations);

  if (!content) {
    const texts = fallback.slice(0, 3);
    const { options, record } = assignOptionIds(texts);
    return {
      previewToken: await storeTextPreview(request, record, userId),
      options,
      fallback: structuredText,
    };
  }

  try {
    const parsed = JSON.parse(content) as { variations?: unknown };
    const rawVariations = Array.isArray(parsed.variations)
      ? parsed.variations.filter((value): value is string => typeof value === "string")
      : [];

    const variationTexts = dedupeVariations([...rawVariations, ...fallback]).slice(0, 3);
    if (variationTexts.length === 3) {
      const { options, record } = assignOptionIds(variationTexts);
      return {
        previewToken: await storeTextPreview(request, record, userId),
        options,
        fallback: structuredText,
      };
    }
  } catch {
    // Fall back to deterministic variants below.
  }

  const texts = fallback.slice(0, 3);
  const { options, record } = assignOptionIds(texts);
  return {
    previewToken: await storeTextPreview(request, record, userId),
    options,
    fallback: structuredText,
  };
}

/**
 * Returns stored prose for an argument, falling back to deterministic rendering.
 *
 * @param argumentId Argument identifier.
 * @returns Object containing the prose string used in read views.
 * @throws {Error} When argument or scheme resolution fails.
 */
export async function getStoredArgumentText(argumentId: string): Promise<{ prose: string }> {
  const argument = await getArgumentById(argumentId);
  if (!argument) {
    throw new Error("ARGUMENT_NOT_FOUND");
  }

  if (argument.argumentText.trim().length > 0) {
    return { prose: argument.argumentText };
  }

  const scheme = getSchemeById(argument.schemeId);
  if (!scheme) {
    throw new Error(`Unknown scheme: ${argument.schemeId}`);
  }

  return {
    prose: renderArgumentText(
      scheme.conclusion,
      argument.variables.map((variable) => ({
        variableId: variable.variableId,
        value: variable.value,
      })),
    ),
  };
}
