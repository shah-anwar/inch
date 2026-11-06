import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";

const axiosPost = jest.fn();

jest.unstable_mockModule("axios", () => ({
  __esModule: true,
  default: { post: axiosPost, get: jest.fn() },
  post: axiosPost,
  get: jest.fn(),
}));

type MistralModule = typeof import("../../../../src/modules/argumentation/llm/mistral.js");

let callMistral: MistralModule["callMistral"];

describe("callMistral", () => {
  const originalKey = process.env.MISTRAL_API_KEY;

  beforeAll(async () => {
    const mod = await import("../../../../src/modules/argumentation/llm/mistral.js");
    callMistral = mod.callMistral;
  });

  beforeEach(() => {
    axiosPost.mockReset();
    delete process.env.MISTRAL_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.MISTRAL_API_KEY;
    } else {
      process.env.MISTRAL_API_KEY = originalKey;
    }
  });

  it("returns null when MISTRAL_API_KEY is unset", async () => {
    const result = await callMistral([{ role: "user", content: "hi" }]);
    expect(result).toBeNull();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("posts with default temperature and max_tokens when key is set", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    axiosPost.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "  trimmed reply  " } }],
      },
    });

    const result = await callMistral([
      { role: "system", content: "sys" },
      { role: "user", content: "hello" },
    ]);

    expect(result).toBe("trimmed reply");
    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [url, body, opts] = axiosPost.mock.calls[0]!;
    expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(body).toMatchObject({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hello" },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });
    expect(body).not.toHaveProperty("response_format");
    expect(opts.headers.Authorization).toBe("Bearer sk-test");
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("includes response_format when responseFormat is json_object", async () => {
    process.env.MISTRAL_API_KEY = "k";
    axiosPost.mockResolvedValueOnce({
      data: { choices: [{ message: { content: "{}" } }] },
    });

    await callMistral([{ role: "user", content: "x" }], {
      responseFormat: "json_object",
      temperature: 0.1,
      maxTokens: 100,
    });

    const [, body] = axiosPost.mock.calls[0]!;
    expect(body).toMatchObject({
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });
  });

  it("returns null when message content is not a string", async () => {
    process.env.MISTRAL_API_KEY = "k";
    axiosPost.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 123 as unknown as string } }] },
    });

    const result = await callMistral([{ role: "user", content: "u" }]);
    expect(result).toBeNull();
  });

  it("returns null when choices path is missing", async () => {
    process.env.MISTRAL_API_KEY = "k";
    axiosPost.mockResolvedValueOnce({ data: {} });

    expect(await callMistral([{ role: "user", content: "u" }])).toBeNull();
  });

  it("returns null when axios.post throws", async () => {
    process.env.MISTRAL_API_KEY = "k";
    axiosPost.mockRejectedValueOnce(new Error("network"));

    expect(await callMistral([{ role: "user", content: "u" }])).toBeNull();
  });
});
