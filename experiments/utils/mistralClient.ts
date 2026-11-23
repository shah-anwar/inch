import axios from "axios";
import { ACTIVE_SCHEME_IDS } from "./schemeCatalog.js";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type MistralCallResult = {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  mock: boolean;
};

/**
 * When `EXPERIMENT_MOCK_MISTRAL=1` or no `MISTRAL_API_KEY`, returns JSON aligned
 * with `mockExpectedScheme` so the pipeline stays testable offline.
 */
export async function completeJson(
  messages: ChatMessage[],
  options: {
    mockExpectedScheme?: string;
    /** When true, mock JSON includes `secondaryScheme` (for `top2` prompt). */
    mockSecondary?: boolean;
    /** When set, mock returns moderation JSON instead of scheme classification JSON. */
    moderationMock?: { expectedPass: boolean; firstVariableId: string };
    temperature?: number;
    maxTokens?: number;
  } = {},
): Promise<MistralCallResult> {
  const useMock =
    process.env.EXPERIMENT_MOCK_MISTRAL === "1" || !process.env.MISTRAL_API_KEY;

  if (useMock) {
    if (options.moderationMock) {
      const { expectedPass, firstVariableId } = options.moderationMock;
      const content = expectedPass
        ? JSON.stringify({ passed: true, violations: [] })
        : JSON.stringify({
            passed: false,
            violations: [{ variableId: firstVariableId, reason: "mock violation" }],
          });
      const promptTokens = estimateTokensFromMessages(messages);
      const completionTokens = estimateTokensFromText(content);
      return {
        content,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        mock: true,
      };
    }
    const scheme = options.mockExpectedScheme ?? "expert_opinion";
    let content: string;
    if (options.mockSecondary) {
      const secondary =
        ACTIVE_SCHEME_IDS.find((id) => id !== scheme) ?? "sign";
      content = JSON.stringify({
        scheme,
        secondaryScheme: secondary,
        ambiguity: "low",
      });
    } else {
      content = JSON.stringify({ scheme, ambiguity: "low" });
    }
    const promptTokens = estimateTokensFromMessages(messages);
    const completionTokens = estimateTokensFromText(content);
    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      mock: true,
    };
  }

  const apiKey = process.env.MISTRAL_API_KEY!;
  try {
    const response = await axios.post(
      MISTRAL_API_URL,
      {
        model: DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 512,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      },
    );
    const data = response.data as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content;
    const content = typeof text === "string" ? text.trim() : "";
    const u = data.usage;
    return {
      content,
      promptTokens: u?.prompt_tokens ?? null,
      completionTokens: u?.completion_tokens ?? null,
      totalTokens: u?.total_tokens ?? null,
      mock: false,
    };
  } catch {
    return {
      content: "",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      mock: false,
    };
  }
}

export function estimateTokensFromMessages(messages: ChatMessage[]): number {
  const text = messages.map((m) => m.content).join("\n");
  return estimateTokensFromText(text);
}

export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}
