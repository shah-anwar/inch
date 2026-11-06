import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import type { GenerateArgumentTextRequest } from "@inch/types";

const getRedisClient = jest.fn();

jest.unstable_mockModule("../../../../src/cache/redis.js", () => ({
  getRedisClient,
}));

type PreviewModule =
  typeof import("../../../../src/modules/argumentation/llm/text-preview-store.js");

let storeTextPreview: PreviewModule["storeTextPreview"];
let validateAndConsumeTextPreview: PreviewModule["validateAndConsumeTextPreview"];
let releaseTextPreview: PreviewModule["releaseTextPreview"];

const baseRequest: GenerateArgumentTextRequest = {
  kind: "initial",
  schemeId: "expert_opinion",
  subtopicId: 1,
  variables: [
    { variableId: "claim", value: "  ice melts  " },
    { variableId: "domain", value: "physics" },
  ],
};

function altOrderRequest(): GenerateArgumentTextRequest {
  return {
    ...baseRequest,
    variables: [
      { variableId: "domain", value: "physics" },
      { variableId: "claim", value: "ice melts" },
    ],
  };
}

describe("text-preview-store", () => {
  beforeAll(async () => {
    const mod = await import("../../../../src/modules/argumentation/llm/text-preview-store.js");
    storeTextPreview = mod.storeTextPreview;
    validateAndConsumeTextPreview = mod.validateAndConsumeTextPreview;
    releaseTextPreview = mod.releaseTextPreview;
  });

  beforeEach(() => {
    getRedisClient.mockReset();
  });

  describe("Redis-backed store", () => {
    const redis = {
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };

    let roundTrip = "";

    beforeEach(() => {
      getRedisClient.mockReturnValue(redis as never);
      roundTrip = "";
      redis.set.mockImplementation((_key: string, val: string) => {
        roundTrip = val;
        return Promise.resolve("OK");
      });
      redis.get.mockImplementation(() => Promise.resolve(roundTrip || null));
      redis.del.mockResolvedValue(1);
    });

    it("storeTextPreview writes JSON with TTL", async () => {
      const token = await storeTextPreview(baseRequest, { o1: "opt" }, "user-a");
      expect(typeof token).toBe("string");
      expect(redis.set).toHaveBeenCalledWith(
        `argument-text-preview:${token}`,
        expect.any(String),
        "EX",
        600,
      );
    });

    it("validateAndConsumeTextPreview succeeds then deletes the key", async () => {
      const token = await storeTextPreview(baseRequest, { pick: "Option one" }, "user-a");

      const text = await validateAndConsumeTextPreview({
        token,
        request: baseRequest,
        selectedOptionId: "pick",
        userId: "user-a",
      });

      expect(text).toBe("Option one");
      expect(redis.del).toHaveBeenCalledWith(`argument-text-preview:${token}`);
    });

    it("throws when Redis returns no preview payload", async () => {
      roundTrip = "";
      redis.get.mockResolvedValue(null);
      await expect(
        validateAndConsumeTextPreview({
          token: "missing",
          request: baseRequest,
          selectedOptionId: "x",
          userId: "u",
        }),
      ).rejects.toThrow(/invalid or expired/i);
    });

    it("throws on signature mismatch and deletes the preview", async () => {
      const token = await storeTextPreview(baseRequest, { x: "y" }, "user-a");

      await expect(
        validateAndConsumeTextPreview({
          token,
          request: { ...baseRequest, schemeId: "other_scheme" },
          selectedOptionId: "x",
          userId: "user-a",
        }),
      ).rejects.toThrow(/Request mismatch/);
      expect(redis.del).toHaveBeenCalledWith(`argument-text-preview:${token}`);
    });

    it("throws when user does not match", async () => {
      const token = await storeTextPreview(baseRequest, { x: "y" }, "owner");

      await expect(
        validateAndConsumeTextPreview({
          token,
          request: baseRequest,
          selectedOptionId: "x",
          userId: "someone-else",
        }),
      ).rejects.toThrow(/does not belong/);
    });

    it("throws when option id is not in the preview", async () => {
      const token = await storeTextPreview(baseRequest, { a: "only-a" }, "user-a");

      await expect(
        validateAndConsumeTextPreview({
          token,
          request: baseRequest,
          selectedOptionId: "not-there",
          userId: "user-a",
        }),
      ).rejects.toThrow(/Invalid option/);
    });

    it("accepts variable reordering when values match (signature)", async () => {
      const token = await storeTextPreview(altOrderRequest(), { pick: "OK" }, "user-a");

      const text = await validateAndConsumeTextPreview({
        token,
        request: baseRequest,
        selectedOptionId: "pick",
        userId: "user-a",
      });
      expect(text).toBe("OK");
    });

    it("releaseTextPreview deletes the Redis key when user matches", async () => {
      const token = await storeTextPreview(baseRequest, { a: "1" }, "u1");
      await releaseTextPreview(token, "u1");
      expect(redis.del).toHaveBeenCalledWith(`argument-text-preview:${token}`);
    });

    it("releaseTextPreview throws when user does not match", async () => {
      const token = await storeTextPreview(baseRequest, { a: "1" }, "u1");
      await expect(releaseTextPreview(token, "u2")).rejects.toThrow(/does not belong/);
    });
  });

  describe("In-memory store", () => {
    beforeEach(() => {
      getRedisClient.mockReturnValue(null);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("validateAndConsumeTextPreview reads from memory and consumes", async () => {
      const token = await storeTextPreview(baseRequest, { only: "Memory option" }, "mem-user");

      const text = await validateAndConsumeTextPreview({
        token,
        request: baseRequest,
        selectedOptionId: "only",
        userId: "mem-user",
      });
      expect(text).toBe("Memory option");

      await expect(
        validateAndConsumeTextPreview({
          token,
          request: baseRequest,
          selectedOptionId: "only",
          userId: "mem-user",
        }),
      ).rejects.toThrow(/invalid or expired/i);
    });

    it("treats expired memory entries as missing", async () => {
      jest.useFakeTimers();
      const token = await storeTextPreview(baseRequest, { o: "ttl" }, "u");

      jest.advanceTimersByTime(10 * 60 * 1000 + 1);

      await expect(
        validateAndConsumeTextPreview({
          token,
          request: baseRequest,
          selectedOptionId: "o",
          userId: "u",
        }),
      ).rejects.toThrow(/invalid or expired/i);
    });

    it("releaseTextPreview removes memory entry", async () => {
      const token = await storeTextPreview(baseRequest, { n: "1" }, "u");
      await releaseTextPreview(token, "u");
      await expect(
        validateAndConsumeTextPreview({
          token,
          request: baseRequest,
          selectedOptionId: "n",
          userId: "u",
        }),
      ).rejects.toThrow(/invalid or expired/i);
    });
  });
});
