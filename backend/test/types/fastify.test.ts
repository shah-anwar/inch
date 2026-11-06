import { describe, it } from "@jest/globals";

// `src/types/fastify.d.ts` is an ambient module declaration with no runtime exports.
// It augments Fastify's types and cannot be imported/tested at runtime.
// It is excluded from coverage via jest.config.ts (`!src/types/**`).
describe.skip("types/fastify.d.ts (ambient)", () => {
  it("has no runtime surface to test", () => {
    // placeholder
  });
});
