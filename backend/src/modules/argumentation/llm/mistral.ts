import axios from "axios";

// The LLM boundary. Every model call in the backend goes through `callMistral`,
// which returns null instead of throwing when the key is missing or a request
// fails. Callers treat null as "no help available" and fall back:
//   - moderation.ts fails open and lets the input through
//   - scheme-matcher.ts returns no suggestions
//   - argument-text.ts returns deterministic template phrasings
//   - POST /arguments/path-dialogue (argument.routes.ts) returns the turns as
//     plain structured text; the frontend does not currently call this route
// The model only proposes wording and suggestions. It never creates attack edges
// or decides argument status; that is done by evaluation.ts.

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface MistralOptions {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "json_object";
}

/**
 * Calls Mistral chat completions API for bounded natural-language helper tasks.
 *
 * @param messages Prompt message sequence.
 * @param options Generation controls and optional JSON response mode.
 * @returns Trimmed model content, or `null` when API key is missing or request fails.
 */
export async function callMistral(
  messages: Message[],
  options: MistralOptions = {},
): Promise<string | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await axios.post(
      MISTRAL_API_URL,
      {
        model: MISTRAL_MODEL,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 600,
        ...(options.responseFormat === "json_object"
          ? { response_format: { type: "json_object" } }
          : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch {
    return null;
  }
}
