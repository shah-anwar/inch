import type { ChatMessage, MistralCallResult } from "./mistralClient.js";
import { estimateTokensFromMessages, estimateTokensFromText } from "./mistralClient.js";
import type { TokenUsage } from "../types/experimentResults.js";

/**
 * Prefer API usage; otherwise estimate prompt and completion separately (chars / 4).
 */
export function resolveTokenUsage(
  messages: ChatMessage[],
  completionText: string,
  raw: MistralCallResult,
): TokenUsage {
  if (raw.promptTokens != null && raw.completionTokens != null) {
    const total =
      raw.totalTokens ?? raw.promptTokens + raw.completionTokens;
    return {
      prompt: raw.promptTokens,
      completion: raw.completionTokens,
      total,
    };
  }
  const prompt = estimateTokensFromMessages(messages);
  const completion = estimateTokensFromText(completionText);
  return {
    prompt,
    completion,
    total: prompt + completion,
  };
}
