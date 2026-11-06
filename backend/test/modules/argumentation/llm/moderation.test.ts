import { describe, it, expect, beforeAll, beforeEach, jest } from "@jest/globals";

const callMistral = jest.fn();

jest.unstable_mockModule("../../../../src/modules/argumentation/llm/mistral.js", () => ({
  callMistral,
}));

type ModerationModule = typeof import("../../../../src/modules/argumentation/llm/moderation.js");

let moderateArgumentSubmission: ModerationModule["moderateArgumentSubmission"];
let moderateVariableInputs: ModerationModule["moderateVariableInputs"];

const baseParams = {
  schemeId: "expert_opinion",
  schemeName: "Argument from Expert Opinion",
  conclusionTemplate: "A is true (false).",
  variables: [
    { variableId: "expert", label: "Expert (E)", value: "Dr. X" },
    { variableId: "domain", label: "Subject Domain (S)", value: "climate" },
    { variableId: "claim", label: "Claim (A)", value: "Warming" },
  ],
};

beforeAll(async () => {
  const mod = await import("../../../../src/modules/argumentation/llm/moderation.js");
  moderateArgumentSubmission = mod.moderateArgumentSubmission;
  moderateVariableInputs = mod.moderateVariableInputs;
});

beforeEach(() => {
  callMistral.mockReset();
});

describe("moderateArgumentSubmission", () => {
  it("allows submissions and returns no reason (placeholder)", async () => {
    const result = await moderateArgumentSubmission("any text here");
    expect(result).toEqual({ allowed: true, reason: null });
  });

  it("ignores text content for the placeholder decision", async () => {
    const empty = await moderateArgumentSubmission("");
    const long = await moderateArgumentSubmission("x".repeat(10_000));
    expect(empty).toEqual(long);
  });
});

describe("moderateVariableInputs", () => {
  it("returns passed true when the model JSON says pass", async () => {
    callMistral.mockResolvedValue(JSON.stringify({ passed: true, violations: [] }));
    await expect(moderateVariableInputs(baseParams)).resolves.toEqual({
      passed: true,
    });
    expect(callMistral).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        temperature: 0.1,
        maxTokens: 256,
        responseFormat: "json_object",
      }),
    );
  });

  it("returns passed false with violations when the model flags issues", async () => {
    callMistral.mockResolvedValue(
      JSON.stringify({
        passed: false,
        violations: [{ variableId: "claim", reason: "Bad" }],
      }),
    );
    await expect(moderateVariableInputs(baseParams)).resolves.toEqual({
      passed: false,
      violations: [{ variableId: "claim", reason: "Bad" }],
    });
  });

  it("drops violation entries for unknown variableIds", async () => {
    callMistral.mockResolvedValue(
      JSON.stringify({
        passed: false,
        violations: [
          { variableId: "claim", reason: "Bad" },
          { variableId: "not_a_real_id", reason: "Ignore" },
        ],
      }),
    );
    await expect(moderateVariableInputs(baseParams)).resolves.toEqual({
      passed: false,
      violations: [{ variableId: "claim", reason: "Bad" }],
    });
  });

  it("fails open when the model flags fail but no valid variable ids remain", async () => {
    callMistral.mockResolvedValue(
      JSON.stringify({
        passed: false,
        violations: [{ variableId: "ghost", reason: "x" }],
      }),
    );
    await expect(moderateVariableInputs(baseParams)).resolves.toEqual({
      passed: true,
    });
  });

  it("fails open when Mistral returns null", async () => {
    callMistral.mockResolvedValue(null);
    await expect(moderateVariableInputs(baseParams)).resolves.toEqual({
      passed: true,
    });
  });

  it("fails open when response is not valid JSON", async () => {
    callMistral.mockResolvedValue("not-json");
    await expect(moderateVariableInputs(baseParams)).resolves.toEqual({
      passed: true,
    });
  });

  it("fails open when JSON does not match the schema", async () => {
    callMistral.mockResolvedValue(JSON.stringify({ foo: 1 }));
    await expect(moderateVariableInputs(baseParams)).resolves.toEqual({
      passed: true,
    });
  });
});
