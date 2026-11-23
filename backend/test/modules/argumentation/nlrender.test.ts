import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const getStoredArgumentText = jest.fn();

jest.unstable_mockModule("../../../src/modules/argumentation/llm/argument-text.js", () => ({
  getStoredArgumentText,
}));

type Nlrender = typeof import("../../../src/modules/argumentation/nlrender.js");

let nlrender: Nlrender;

beforeEach(async () => {
  getStoredArgumentText.mockReset();
  jest.resetModules();
  jest.unstable_mockModule("../../../src/modules/argumentation/llm/argument-text.js", () => ({
    getStoredArgumentText,
  }));
  nlrender = await import("../../../src/modules/argumentation/nlrender.js");
});

describe("nlrender", () => {
  it("re-exports getStoredArgumentText as renderArgumentNL with the same identity", () => {
    expect(nlrender.renderArgumentNL).toBe(getStoredArgumentText);
  });

  it("forwards calls to the underlying implementation", async () => {
    getStoredArgumentText.mockResolvedValue({ prose: "hello" });
    await expect(nlrender.renderArgumentNL("arg-1")).resolves.toEqual({
      prose: "hello",
    });
    expect(getStoredArgumentText).toHaveBeenCalledWith("arg-1");
  });
});
