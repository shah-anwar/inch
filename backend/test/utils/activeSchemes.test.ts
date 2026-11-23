import { describe, it, expect } from "@jest/globals";
import {
  allowsResponseScheme,
  getVisibleCriticalQuestions,
  getVisibleSchemes,
} from "../../src/utils/activeSchemes.js";

// An empty validResponseSchemeIds list means "any scheme may respond", matching
// getValidResponseSchemes in @inch/types and the seed data.

const openCq = { id: "cq_open", validResponseSchemeIds: [] as string[] };
const restrictedCq = { id: "cq_restricted", validResponseSchemeIds: ["a", "b"] };

describe("allowsResponseScheme", () => {
  it("allows any scheme when the list is empty", () => {
    expect(allowsResponseScheme(openCq, "a")).toBe(true);
    expect(allowsResponseScheme(openCq, "anything")).toBe(true);
  });

  it("allows only listed schemes when the list is non-empty", () => {
    expect(allowsResponseScheme(restrictedCq, "a")).toBe(true);
    expect(allowsResponseScheme(restrictedCq, "c")).toBe(false);
  });
});

describe("getVisibleCriticalQuestions", () => {
  it("shows an empty-list CQ whenever any scheme is active", () => {
    expect(getVisibleCriticalQuestions(["c"], [openCq])).toEqual([openCq]);
  });

  it("hides an empty-list CQ when no scheme is active", () => {
    expect(getVisibleCriticalQuestions([], [openCq])).toEqual([]);
  });

  it("shows a restricted CQ only when one of its listed schemes is active", () => {
    expect(getVisibleCriticalQuestions(["b"], [restrictedCq])).toEqual([restrictedCq]);
    expect(getVisibleCriticalQuestions(["c"], [restrictedCq])).toEqual([]);
  });
});

describe("getVisibleSchemes", () => {
  const schemeWithOpenCq = { id: "a", criticalQuestions: [openCq] };
  const schemeWithRestrictedCq = { id: "c", criticalQuestions: [restrictedCq] };
  const schemeWithoutCqs = { id: "b", criticalQuestions: [] as (typeof openCq)[] };

  it("keeps active schemes that have at least one visible CQ", () => {
    expect(
      getVisibleSchemes(
        ["a", "b", "c"],
        [schemeWithOpenCq, schemeWithRestrictedCq, schemeWithoutCqs],
      ),
    ).toEqual([schemeWithOpenCq, schemeWithRestrictedCq]);
  });

  it("drops inactive schemes", () => {
    expect(getVisibleSchemes(["b"], [schemeWithOpenCq])).toEqual([]);
  });

  it("drops a scheme whose only CQ lists no active scheme", () => {
    expect(getVisibleSchemes(["c"], [schemeWithRestrictedCq])).toEqual([]);
  });
});
