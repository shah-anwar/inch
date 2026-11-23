import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const rankSchemesFromFreeText = jest.fn();

jest.unstable_mockModule("../../../src/modules/argumentation/llm/scheme-matcher.js", () => ({
  rankSchemesFromFreeText,
}));

type SchemeSuggester = typeof import("../../../src/modules/argumentation/scheme-suggester.js");

let schemeSuggester: SchemeSuggester;

beforeEach(async () => {
  rankSchemesFromFreeText.mockReset();
  jest.resetModules();
  jest.unstable_mockModule("../../../src/modules/argumentation/llm/scheme-matcher.js", () => ({
    rankSchemesFromFreeText,
  }));
  schemeSuggester = await import("../../../src/modules/argumentation/scheme-suggester.js");
});

describe("scheme-suggester", () => {
  it("re-exports rankSchemesFromFreeText as suggestSchemes with the same identity", () => {
    expect(schemeSuggester.suggestSchemes).toBe(rankSchemesFromFreeText);
  });

  it("forwards the free-text argument to rankSchemesFromFreeText", async () => {
    const out = { suggestions: [] };
    rankSchemesFromFreeText.mockResolvedValue(out);

    await expect(schemeSuggester.suggestSchemes("climate policy debate")).resolves.toBe(out);

    expect(rankSchemesFromFreeText).toHaveBeenCalledTimes(1);
    expect(rankSchemesFromFreeText).toHaveBeenCalledWith("climate policy debate");
  });
});
