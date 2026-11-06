import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

const callMistral = jest.fn();
const getArgumentById = jest.fn();

jest.unstable_mockModule("../../../../src/modules/argumentation/llm/mistral.js", () => ({
  callMistral,
}));

jest.unstable_mockModule("../../../../src/modules/argumentation/argument.repository.js", () => ({
  getArgumentById,
}));

type ArgumentTextModule =
  typeof import("../../../../src/modules/argumentation/llm/argument-text.js");

let generateArgumentTextVariations: ArgumentTextModule["generateArgumentTextVariations"];
let getStoredArgumentText: ArgumentTextModule["getStoredArgumentText"];

const initialRequest = {
  kind: "initial" as const,
  schemeId: "expert_opinion",
  subtopicId: 1,
  variables: [
    { variableId: "expert", value: "Dr. Ada" },
    { variableId: "domain", value: "logic" },
    { variableId: "claim", value: "P equals NP" },
  ],
};

const initialRequestEmptyVars = {
  kind: "initial" as const,
  schemeId: "expert_opinion",
  subtopicId: 1,
  variables: [] as { variableId: string; value: string }[],
};

const previewUserId = "preview-user";

describe("argument-text", () => {
  beforeAll(async () => {
    const mod = await import("../../../../src/modules/argumentation/llm/argument-text.js");
    generateArgumentTextVariations = mod.generateArgumentTextVariations;
    getStoredArgumentText = mod.getStoredArgumentText;
  });

  beforeEach(() => {
    callMistral.mockReset();
    getArgumentById.mockReset();
  });

  describe("generateArgumentTextVariations", () => {
    it("rejects unknown schemes", async () => {
      await expect(
        generateArgumentTextVariations(
          {
            ...initialRequest,
            schemeId: "not_a_real_scheme_id",
          },
          previewUserId,
        ),
      ).rejects.toThrow(/Unknown scheme/);
    });

    it("uses deterministic fallbacks when Mistral returns null", async () => {
      callMistral.mockResolvedValue(null);
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options).toHaveLength(3);
      expect(result.previewToken.length).toBeGreaterThan(0);
      expect(result.fallback).toBeTruthy();
      expect(callMistral).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
        { maxTokens: 500, temperature: 0.5, responseFormat: "json_object" },
      );
    });

    it("includes None provided for variables when the list is empty", async () => {
      callMistral.mockResolvedValue(null);
      await generateArgumentTextVariations(initialRequestEmptyVars, previewUserId);
      const userContent = callMistral.mock.calls[0]![0][1]!.content as string;
      expect(userContent).toContain("None provided.");
    });

    it("falls back to variableId when a variable id is not defined on the scheme", async () => {
      callMistral.mockResolvedValue(null);
      await generateArgumentTextVariations(
        {
          ...initialRequest,
          variables: [
            ...initialRequest.variables,
            { variableId: "not_a_scheme_variable", value: "orphan" },
          ],
        },
        previewUserId,
      );
      const userContent = callMistral.mock.calls[0]![0][1]!.content as string;
      expect(userContent).toContain("not_a_scheme_variable: orphan");
    });

    it("parses valid JSON variations and returns three options", async () => {
      callMistral.mockResolvedValue(
        JSON.stringify({
          variations: ["Alpha phrasing", "Beta phrasing", "Gamma phrasing"],
        }),
      );
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options.map((v) => v.text)).toEqual([
        "Alpha phrasing",
        "Beta phrasing",
        "Gamma phrasing",
      ]);
      expect(new Set(result.options.map((v) => v.id)).size).toBe(3);
    });

    it("merges string variations with fallbacks, dedupes case-insensitively, and trims to three", async () => {
      callMistral.mockResolvedValue(
        JSON.stringify({
          variations: ["Shared", "SHARED", "  unique tail  "],
        }),
      );
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options).toHaveLength(3);
      expect(new Set(result.options.map((v) => v.text.toLowerCase())).size).toBe(3);
    });

    it("falls back when JSON is invalid", async () => {
      callMistral.mockResolvedValue("not-json{");
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options).toHaveLength(3);
    });

    it("falls back when variations is not an array", async () => {
      callMistral.mockResolvedValue(JSON.stringify({ variations: { x: 1 } }));
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options).toHaveLength(3);
    });

    it("filters non-string entries from the variations array", async () => {
      callMistral.mockResolvedValue(
        JSON.stringify({ variations: [1, null, "kept", false, "also-kept", {}] }),
      );
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options).toHaveLength(3);
      expect(result.options.map((v) => v.text)).toContain("kept");
      expect(result.options.map((v) => v.text)).toContain("also-kept");
    });

    it("skips empty normalised variations when merging model output", async () => {
      callMistral.mockResolvedValue(JSON.stringify({ variations: ["", "   ", "solid line"] }));
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options.map((v) => v.text)).toContain("solid line");
      expect(result.options).toHaveLength(3);
    });

    it("uses outer fallbacks when fewer than three usable variations remain", async () => {
      callMistral.mockResolvedValue(JSON.stringify({ variations: ["only-one"] }));
      const result = await generateArgumentTextVariations(initialRequest, previewUserId);
      expect(result.options).toHaveLength(3);
    });

    it("throws when counter flow cannot resolve the parent argument", async () => {
      getArgumentById.mockResolvedValue(null);
      await expect(
        generateArgumentTextVariations(
          {
            kind: "counter",
            schemeId: "position_to_know",
            parentArgumentId: "missing-parent",
            selectedCqId: "cq_eo_1",
            variables: [
              { variableId: "source", value: "witness" },
              { variableId: "domain", value: "scene" },
              { variableId: "claim", value: "rain fell" },
            ],
          },
          previewUserId,
        ),
      ).rejects.toThrow(/Parent argument not found/);
    });

    it("builds counter-argument prompts with parent text, CQ line, and Mistral JSON", async () => {
      getArgumentById.mockResolvedValue({
        id: "p1",
        schemeId: "expert_opinion",
        argumentText: "  Custom parent prose  ",
        variables: [
          { variableId: "expert", value: "Dr. B" },
          { variableId: "domain", value: "chem" },
          { variableId: "claim", value: "reaction occurs" },
        ],
      } as never);
      callMistral.mockResolvedValue(
        JSON.stringify({
          variations: ["C1", "C2", "C3"],
        }),
      );

      const result = await generateArgumentTextVariations(
        {
          kind: "counter",
          schemeId: "position_to_know",
          parentArgumentId: "p1",
          selectedCqId: "cq_eo_1",
          variables: [
            { variableId: "source", value: "guard" },
            { variableId: "domain", value: "lab" },
            { variableId: "claim", value: "sample was contaminated" },
          ],
        },
        previewUserId,
      );

      const userContent = callMistral.mock.calls[0]![0][1]!.content as string;
      expect(userContent).toContain("Custom parent prose");
      expect(userContent).toContain("Critical question raised:");
      expect(result.options.map((v) => v.text)).toEqual(["C1", "C2", "C3"]);
    });

    it("omits the critical question line when the CQ id is unknown", async () => {
      getArgumentById.mockResolvedValue({
        id: "p2",
        schemeId: "expert_opinion",
        argumentText: "",
        variables: [
          { variableId: "expert", value: "Dr. C" },
          { variableId: "domain", value: "math" },
          { variableId: "claim", value: "x" },
        ],
      } as never);
      callMistral.mockResolvedValue(null);

      await generateArgumentTextVariations(
        {
          kind: "counter",
          schemeId: "position_to_know",
          parentArgumentId: "p2",
          selectedCqId: "not-a-real-cq",
          variables: [
            { variableId: "source", value: "a" },
            { variableId: "domain", value: "b" },
            { variableId: "claim", value: "c" },
          ],
        },
        previewUserId,
      );

      const userContent = callMistral.mock.calls[0]![0][1]!.content as string;
      expect(userContent).not.toContain("Critical question raised:");
    });

    it("uses rendered parent structure when argumentText is empty and scheme is known", async () => {
      getArgumentById.mockResolvedValue({
        id: "p3",
        schemeId: "expert_opinion",
        argumentText: "",
        variables: [
          { variableId: "expert", value: "Dr. D" },
          { variableId: "domain", value: "stats" },
          { variableId: "claim", value: "p-value low" },
        ],
      } as never);
      callMistral.mockResolvedValue(null);

      await generateArgumentTextVariations(
        {
          kind: "counter",
          schemeId: "position_to_know",
          parentArgumentId: "p3",
          selectedCqId: "cq_eo_1",
          variables: [
            { variableId: "source", value: "s" },
            { variableId: "domain", value: "d" },
            { variableId: "claim", value: "c" },
          ],
        },
        previewUserId,
      );

      const userContent = callMistral.mock.calls[0]![0][1]!.content as string;
      expect(userContent).toContain("Parent argument text:");
    });

    it("uses empty parent structured text when the parent scheme is unknown", async () => {
      getArgumentById.mockResolvedValue({
        id: "p4",
        schemeId: "unknown_scheme_xyz",
        argumentText: "",
        variables: [],
      } as never);
      callMistral.mockResolvedValue(null);

      await generateArgumentTextVariations(
        {
          kind: "counter",
          schemeId: "position_to_know",
          parentArgumentId: "p4",
          selectedCqId: "cq_eo_1",
          variables: [
            { variableId: "source", value: "s" },
            { variableId: "domain", value: "d" },
            { variableId: "claim", value: "c" },
          ],
        },
        previewUserId,
      );

      const userContent = callMistral.mock.calls[0]![0][1]!.content as string;
      expect(userContent).toContain("Parent argument text:");
    });

    it("shows None provided for counter prompts when no variables are supplied", async () => {
      getArgumentById.mockResolvedValue({
        id: "p5",
        schemeId: "expert_opinion",
        argumentText: "Parent",
        variables: [
          { variableId: "expert", value: "E" },
          { variableId: "domain", value: "D" },
          { variableId: "claim", value: "C" },
        ],
      } as never);
      callMistral.mockResolvedValue(null);

      await generateArgumentTextVariations(
        {
          kind: "counter",
          schemeId: "position_to_know",
          parentArgumentId: "p5",
          selectedCqId: "cq_eo_1",
          variables: [],
        },
        previewUserId,
      );

      const userContent = callMistral.mock.calls[0]![0][1]!.content as string;
      expect(userContent).toContain("Variables:\nNone provided.");
    });
  });

  describe("getStoredArgumentText", () => {
    it("throws when the argument does not exist", async () => {
      getArgumentById.mockResolvedValue(null);
      await expect(getStoredArgumentText("nope")).rejects.toThrow("ARGUMENT_NOT_FOUND");
    });

    it("returns stored prose as-is when argumentText is non-empty", async () => {
      getArgumentById.mockResolvedValue({
        id: "a1",
        schemeId: "expert_opinion",
        argumentText: "  Stored line  ",
        variables: [],
      } as never);

      const { prose } = await getStoredArgumentText("a1");
      expect(prose).toBe("  Stored line  ");
    });

    it("renders from the scheme when argumentText is blank", async () => {
      getArgumentById.mockResolvedValue({
        id: "a2",
        schemeId: "expert_opinion",
        argumentText: "   ",
        variables: [
          { variableId: "expert", value: "E" },
          { variableId: "domain", value: "D" },
          { variableId: "claim", value: "C" },
        ],
      } as never);

      const { prose } = await getStoredArgumentText("a2");
      expect(prose).toBe("A is true (false).");
    });

    it("throws when the scheme is unknown", async () => {
      getArgumentById.mockResolvedValue({
        id: "a3",
        schemeId: "bad_scheme",
        argumentText: "",
        variables: [],
      } as never);

      await expect(getStoredArgumentText("a3")).rejects.toThrow(/Unknown scheme/);
    });
  });
});
