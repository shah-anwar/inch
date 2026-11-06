import { describe, it } from "@jest/globals";

// `src/modules/argumentation/argumentation.types.ts` is an empty file reserved for type exports.
// It is excluded from coverage via jest.config.ts (`!src/**/*.types.ts`).
describe.skip("argumentation.types.ts (empty types module)", () => {
  it("has no runtime surface to test", () => {
    // placeholder
  });
});
