import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import type { FastifyReply, FastifyRequest } from "fastify";
import { buildReplyMock, buildRequestMock } from "../setup/mocks/fastify.js";

const jwtVerify = jest.fn();
const findUserByUsername = jest.fn();

jest.unstable_mockModule("jsonwebtoken", () => ({
  __esModule: true,
  default: { verify: jwtVerify },
}));

jest.unstable_mockModule("../../src/modules/user/user.repository.js", () => ({
  findUserByUsername,
}));

type AuthModule = typeof import("../../src/utils/auth.js");

let getAuthenticatedUser: AuthModule["getAuthenticatedUser"];
let getAdminUser: AuthModule["getAdminUser"];

beforeAll(async () => {
  const mod = await import("../../src/utils/auth.js");
  getAuthenticatedUser = mod.getAuthenticatedUser;
  getAdminUser = mod.getAdminUser;
});

const baseUser = {
  id: 7,
  username: "alice",
  email: "alice@example.com",
  createdAt: new Date("2024-06-01T00:00:00.000Z"),
  isAdmin: false,
};

describe("getAuthenticatedUser", () => {
  beforeEach(() => {
    jwtVerify.mockReset();
    findUserByUsername.mockReset();
  });

  it("sends 401 when the Authorization header is missing", async () => {
    const request = buildRequestMock({
      headers: {},
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAuthenticatedUser(request, reply);

    expect(result).toBeNull();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: "Unauthorised" });
    expect(jwtVerify).not.toHaveBeenCalled();
    expect(findUserByUsername).not.toHaveBeenCalled();
  });

  it('sends 401 when the Authorization header does not start with "Bearer "', async () => {
    const request = buildRequestMock({
      headers: { authorization: "Basic abc" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAuthenticatedUser(request, reply);

    expect(result).toBeNull();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: "Unauthorised" });
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("sends 401 when JWT verification throws", async () => {
    jwtVerify.mockImplementation(() => {
      throw new Error("invalid signature");
    });
    const request = buildRequestMock({
      headers: { authorization: "Bearer badtoken" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAuthenticatedUser(request, reply);

    expect(result).toBeNull();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: "Unauthorised" });
    expect(jwtVerify).toHaveBeenCalledWith("badtoken", process.env.JWT_SECRET);
  });

  it("sends 401 when the JWT payload fails schema validation", async () => {
    jwtVerify.mockReturnValue({ sub: "ab" });
    const request = buildRequestMock({
      headers: { authorization: "Bearer token" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAuthenticatedUser(request, reply);

    expect(result).toBeNull();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: "Unauthorised" });
    expect(findUserByUsername).not.toHaveBeenCalled();
  });

  it("sends 401 when the user is not found", async () => {
    jwtVerify.mockReturnValue({ sub: "alice" });
    findUserByUsername.mockResolvedValue(null);
    const request = buildRequestMock({
      headers: { authorization: "Bearer good" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAuthenticatedUser(request, reply);

    expect(result).toBeNull();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: "Unauthorised" });
    expect(findUserByUsername).toHaveBeenCalledWith("alice");
  });

  it("returns the user and sets request.userId on success", async () => {
    jwtVerify.mockReturnValue({ sub: "alice" });
    findUserByUsername.mockResolvedValue(baseUser);
    const request = buildRequestMock({
      headers: { authorization: "Bearer good" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAuthenticatedUser(request, reply);

    expect(result).toEqual(baseUser);
    expect(request.userId).toBe(baseUser.id);
    expect(reply.statusCode).toBe(200);
    expect(jwtVerify).toHaveBeenCalledWith("good", process.env.JWT_SECRET);
  });
});

describe("getAdminUser", () => {
  beforeEach(() => {
    jwtVerify.mockReset();
    findUserByUsername.mockReset();
  });

  it("returns null when authentication fails without sending 403", async () => {
    const request = buildRequestMock({
      headers: {},
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAdminUser(request, reply);

    expect(result).toBeNull();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: "Unauthorised" });
  });

  it("sends 403 when the user is authenticated but not an admin", async () => {
    jwtVerify.mockReturnValue({ sub: "alice" });
    findUserByUsername.mockResolvedValue(baseUser);
    const request = buildRequestMock({
      headers: { authorization: "Bearer tok" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAdminUser(request, reply);

    expect(result).toBeNull();
    expect(reply.statusCode).toBe(403);
    expect(reply.payload).toEqual({ error: "Admin access required" });
  });

  it("returns the admin user when authentication and role checks pass", async () => {
    const admin = { ...baseUser, isAdmin: true };
    jwtVerify.mockReturnValue({ sub: "alice" });
    findUserByUsername.mockResolvedValue(admin);
    const request = buildRequestMock({
      headers: { authorization: "Bearer tok" },
    }) as unknown as FastifyRequest;
    const reply = buildReplyMock() as unknown as FastifyReply;

    const result = await getAdminUser(request, reply);

    expect(result).toEqual(admin);
    expect(request.userId).toBe(admin.id);
    expect(reply.statusCode).toBe(200);
  });
});
