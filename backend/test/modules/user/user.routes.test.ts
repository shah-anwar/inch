import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  buildFastifyMock,
  buildRequestMock,
  buildReplyMock,
  getRouteHandler,
} from "../../setup/mocks/fastify.js";

const createUser = jest.fn();
const loginUser = jest.fn();
const refreshAccessToken = jest.fn();
const revokeRefreshToken = jest.fn();
const getUserArguments = jest.fn();
const changeUserPassword = jest.fn();
const getAuthenticatedUser = jest.fn();

jest.unstable_mockModule("../../../src/modules/user/user.service.js", () => ({
  createUser,
  loginUser,
  refreshAccessToken,
  revokeRefreshToken,
  getUserArguments,
  changeUserPassword,
}));

jest.unstable_mockModule("../../../src/utils/auth.js", () => ({
  getAuthenticatedUser,
}));

type UserRoutes = typeof import("../../../src/modules/user/user.routes.js");

let userRoutes: UserRoutes["default"];

beforeAll(async () => {
  const mod = await import("../../../src/modules/user/user.routes.js");
  userRoutes = mod.default;
});

describe("user.routes", () => {
  beforeEach(() => {
    createUser.mockReset();
    loginUser.mockReset();
    refreshAccessToken.mockReset();
    revokeRefreshToken.mockReset();
    getAuthenticatedUser.mockReset();
  });

  it("GET /me returns early when unauthenticated without sending again", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "GET", "/me");
    const request = buildRequestMock() as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await handler(request, reply);

    expect(result).toBeUndefined();
    expect(getAuthenticatedUser).toHaveBeenCalledWith(request, reply);
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("GET /me sends 200 and user when authenticated", async () => {
    const user = {
      id: 1,
      username: "alice",
      email: "alice@example.com",
      createdAt: new Date("2024-06-01T00:00:00.000Z"),
      isAdmin: false,
    };
    getAuthenticatedUser.mockResolvedValue(user);
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "GET", "/me");
    const request = buildRequestMock() as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(user);
  });

  it("POST /users returns 201 with trimmed user on success", async () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    createUser.mockResolvedValue({
      id: 42,
      username: "newuser",
      email: "new@example.com",
      password: "hash",
      createdAt,
      isAdmin: false,
    });
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/users");
    const body = {
      username: "newuser",
      email: "new@example.com",
      password: "password12",
    };
    const request = buildRequestMock({ body }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(createUser).toHaveBeenCalledWith(body);
    expect(reply.code).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({
      id: 42,
      username: "newuser",
      email: "new@example.com",
      createdAt,
    });
  });

  it("POST /users returns 400 with validation issues when body is invalid", async () => {
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/users");
    const request = buildRequestMock({
      body: { username: "ab", email: "not-email", password: "short" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(createUser).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(400);
    const sent = (reply as { payload?: { error?: unknown } }).payload;
    expect(sent).toBeDefined();
    expect(Array.isArray(sent?.error)).toBe(true);
  });

  it("POST /users rethrows when createUser fails with a non-validation error", async () => {
    createUser.mockRejectedValue(new Error("database unavailable"));
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/users");
    const request = buildRequestMock({
      body: {
        username: "validu",
        email: "valid@example.com",
        password: "password12",
      },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await expect(handler(request, reply)).rejects.toThrow("database unavailable");
  });

  it("POST /login returns 200 with token on success", async () => {
    loginUser.mockResolvedValue({
      token: "jwt-token-value",
      refreshToken: "refresh-value",
    });
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/login");
    const request = buildRequestMock({
      body: { loginString: "alice", password: "password12" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(loginUser).toHaveBeenCalledWith({
      loginString: "alice",
      password: "password12",
    });
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      token: "jwt-token-value",
      refreshToken: "refresh-value",
    });
  });

  it("POST /auth/refresh returns 200 with new tokens", async () => {
    refreshAccessToken.mockResolvedValue({
      token: "new-access",
      refreshToken: "new-refresh",
    });
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/auth/refresh");
    const request = buildRequestMock({
      body: { refreshToken: "old-refresh" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(refreshAccessToken).toHaveBeenCalledWith("old-refresh");
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      token: "new-access",
      refreshToken: "new-refresh",
    });
  });

  it("POST /auth/refresh returns 401 when refresh fails", async () => {
    refreshAccessToken.mockRejectedValue(new Error("Invalid refresh token"));
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/auth/refresh");
    const request = buildRequestMock({
      body: { refreshToken: "bad" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: "Invalid or expired session",
    });
  });

  it("POST /auth/logout returns 204", async () => {
    revokeRefreshToken.mockResolvedValue(undefined);
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/auth/logout");
    const request = buildRequestMock({
      body: { refreshToken: "rt" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(revokeRefreshToken).toHaveBeenCalledWith("rt");
    expect(reply.code).toHaveBeenCalledWith(204);
  });

  it("POST /auth/refresh returns 400 when body is invalid", async () => {
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/auth/refresh");
    const request = buildRequestMock({
      body: { refreshToken: "" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(400);
    const sent = (reply as { payload?: { error?: unknown } }).payload;
    expect(Array.isArray(sent?.error)).toBe(true);
  });

  it("POST /auth/logout returns 400 when body is invalid", async () => {
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/auth/logout");
    const request = buildRequestMock({
      body: { refreshToken: "" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(revokeRefreshToken).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(400);
    const sent = (reply as { payload?: { error?: unknown } }).payload;
    expect(Array.isArray(sent?.error)).toBe(true);
  });

  it("POST /auth/logout rethrows when revokeRefreshToken fails unexpectedly", async () => {
    revokeRefreshToken.mockRejectedValue(new Error("database down"));
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/auth/logout");
    const request = buildRequestMock({
      body: { refreshToken: "rt" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await expect(handler(request, reply)).rejects.toThrow("database down");
  });

  it("POST /login returns 400 when validation fails", async () => {
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/login");
    const request = buildRequestMock({
      body: { loginString: "ab", password: "short" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(loginUser).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(400);
    const sent = (reply as { payload?: { error?: unknown } }).payload;
    expect(Array.isArray(sent?.error)).toBe(true);
  });

  it("POST /login returns 401 for non-validation errors from loginUser", async () => {
    loginUser.mockRejectedValue(new Error("Invalid credentials"));
    const app = buildFastifyMock();
    await userRoutes(app as unknown as FastifyInstance);

    const handler = getRouteHandler(app, "POST", "/login");
    const request = buildRequestMock({
      body: { loginString: "nobody", password: "password12" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    await handler(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: "Invalid credentials",
    });
  });
});
