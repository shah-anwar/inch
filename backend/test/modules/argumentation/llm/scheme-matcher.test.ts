import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";

const listSchemesForSuggestion = jest.fn();
const callMistral = jest.fn();

jest.unstable_mockModule("../../../../src/modules/argumentation/scheme.repository.js", () => ({
  listSchemesForSuggestion,
}));

jest.unstable_mockModule("../../../../src/modules/argumentation/llm/mistral.js", () => ({
  callMistral,
}));

type Matcher = typeof import("../../../../src/modules/argumentation/llm/scheme-matcher.js");

let rankSchemesFromFreeText: Matcher["rankSchemesFromFreeText"];

const sampleSchemes = [
  {
    id: "expert_opinion",
    name: "Argument from Expert Opinion",
    description: "Expert asserts a claim.",
    variables: [
      {
        id: "expert",
        name: "Expert",
        description: "",
        placeholder: "",
        type: "entity",
        required: true,
      },
    ],
  },
  {
    id: "sign",
    name: "Sign",
    description: "Sign reasoning.",
    variables: [
      { id: "event", name: "E", description: "", placeholder: "", type: "string", required: true },
    ],
  },
  {
    id: "empty_vars_scheme",
    name: "No slots",
    description: "No variables.",
    variables: [] as unknown[],
  },
  {
    id: "bad_var_shape",
    name: "Odd variables",
    description: "Json edge case.",
    variables: [{}, null, { id: "ok" }] as unknown[],
  },
];

describe("rankSchemesFromFreeText", () => {
  beforeAll(async () => {
    const mod = await import("../../../../src/modules/argumentation/llm/scheme-matcher.js");
    rankSchemesFromFreeText = mod.rankSchemesFromFreeText;
  });

  beforeEach(() => {
    listSchemesForSuggestion.mockReset();
    callMistral.mockReset();
  });

  it("returns empty suggestions for whitespace-only text", async () => {
    expect(await rankSchemesFromFreeText("   \n")).toEqual({ suggestions: [] });
    expect(listSchemesForSuggestion).not.toHaveBeenCalled();
  });

  it("returns empty when no schemes exist in the database", async () => {
    listSchemesForSuggestion.mockResolvedValue([]);
    expect(await rankSchemesFromFreeText("some argument text here")).toEqual({
      suggestions: [],
    });
    expect(callMistral).not.toHaveBeenCalled();
  });

  it("returns empty when Mistral returns null", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    callMistral.mockResolvedValue(null);
    expect(await rankSchemesFromFreeText("some argument text here")).toEqual({
      suggestions: [],
    });
  });

  it("maps valid JSON into suggestions with scheme names from DB and filters variable keys", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    callMistral.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          {
            schemeId: "expert_opinion",
            confidence: "high",
            reasoning: "Cites a specialist.",
            prefillVariables: { expert: "Dr. X", bogus: "ignore" },
          },
          {
            schemeId: "unknown_id",
            confidence: "low",
            reasoning: "skip",
            prefillVariables: {},
          },
        ],
      }),
    );

    const out = await rankSchemesFromFreeText("some argument text here");

    expect(out.suggestions).toHaveLength(1);
    expect(out.suggestions[0]).toMatchObject({
      schemeId: "expert_opinion",
      schemeName: "Argument from Expert Opinion",
      confidence: "high",
      reasoning: "Cites a specialist.",
      prefillVariables: { expert: "Dr. X" },
    });
    expect(callMistral).toHaveBeenCalled();
    const [, opts] = callMistral.mock.calls[0]!;
    expect(opts).toMatchObject({
      responseFormat: "json_object",
      temperature: 0.2,
      maxTokens: 1024,
    });
  });

  it("returns empty on invalid JSON from Mistral", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    callMistral.mockResolvedValue("not json");
    expect(await rankSchemesFromFreeText("some argument text here")).toEqual({
      suggestions: [],
    });
  });

  it("returns empty on JSON that fails schema validation", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    callMistral.mockResolvedValue(JSON.stringify({ suggestions: "bad" }));
    expect(await rankSchemesFromFreeText("some argument text here")).toEqual({
      suggestions: [],
    });
  });

  it("truncates overly long reasoning", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    const longReasoning = "x".repeat(600);
    callMistral.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          {
            schemeId: "sign",
            confidence: "medium",
            reasoning: longReasoning,
            prefillVariables: {},
          },
        ],
      }),
    );

    const out = await rankSchemesFromFreeText("some argument text here");
    expect(out.suggestions[0]!.reasoning.length).toBe(500);
  });

  it("dedupes repeated scheme ids and drops empty prefill values", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    callMistral.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          {
            schemeId: "expert_opinion",
            confidence: "high",
            reasoning: "First",
            prefillVariables: { expert: "Dr. A" },
          },
          {
            schemeId: "expert_opinion",
            confidence: "low",
            reasoning: "Duplicate row",
            prefillVariables: {},
          },
          {
            schemeId: "sign",
            confidence: "medium",
            reasoning: "Second",
            prefillVariables: { event: "   ", expert: "not-for-sign" },
          },
        ],
      }),
    );

    const out = await rankSchemesFromFreeText("some argument text here");
    expect(out.suggestions.map((s) => s.schemeId)).toEqual(["expert_opinion", "sign"]);
    expect(out.suggestions[1]!.prefillVariables).toEqual({});
  });

  it("truncates very long prefill values", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    const longVal = "y".repeat(2500);
    callMistral.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          {
            schemeId: "expert_opinion",
            confidence: "high",
            reasoning: "ok",
            prefillVariables: { expert: longVal },
          },
        ],
      }),
    );

    const out = await rankSchemesFromFreeText("some argument text here");
    expect(out.suggestions[0]!.prefillVariables.expert!.length).toBe(2000);
  });

  it("treats empty Mistral content like failure", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    callMistral.mockResolvedValue("");
    expect(await rankSchemesFromFreeText("some argument text here")).toEqual({
      suggestions: [],
    });
  });

  it("drops prefill keys when the scheme defines no variables", async () => {
    listSchemesForSuggestion.mockResolvedValue(sampleSchemes);
    callMistral.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          {
            schemeId: "empty_vars_scheme",
            confidence: "low",
            reasoning: "No vars",
            prefillVariables: { anything: "x" },
          },
        ],
      }),
    );

    const out = await rankSchemesFromFreeText("some argument text here");
    expect(out.suggestions[0]!.prefillVariables).toEqual({});
  });

  it("caps output at five schemes when the model returns more", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      id: `scheme_${i}`,
      name: `Scheme ${i}`,
      description: "D",
      variables: [] as unknown[],
    }));
    listSchemesForSuggestion.mockResolvedValue(six);
    callMistral.mockResolvedValue(
      JSON.stringify({
        suggestions: six.map((s, i) => ({
          schemeId: s.id,
          confidence: "medium" as const,
          reasoning: `R${i}`,
          prefillVariables: {},
        })),
      }),
    );

    const out = await rankSchemesFromFreeText("some argument text here");
    expect(out.suggestions).toHaveLength(5);
  });
});
