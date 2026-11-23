import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import crypto from "node:crypto";

const insertUser = jest.fn();
const findUserByEmail = jest.fn();
const findUserByUsername = jest.fn();
const findUserById = jest.fn();
const listArgumentsByAuthor = jest.fn();
const updateUserPasswordById = jest.fn();

jest.unstable_mockModule("../../../src/modules/user/user.repository.js", () => ({
  insertUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  listArgumentsByAuthor,
  updateUserPasswordById,
}));

const createUserSession = jest.fn();
const findUserSessionByTokenHash = jest.fn();
const deleteUserSessionById = jest.fn();
const deleteUserSessionsByTokenHash = jest.fn();

jest.unstable_mockModule("../../../src/modules/user/user-session.repository.js", () => ({
  createUserSession,
  findUserSessionByTokenHash,
  deleteUserSessionById,
  deleteUserSessionsByTokenHash,
}));

const bcryptCompare = jest.fn();
const bcryptHash = jest.fn();

jest.unstable_mockModule("bcrypt", () => ({
  __esModule: true,
  default: { compare: bcryptCompare, hash: bcryptHash },
  compare: bcryptCompare,
  hash: bcryptHash,
}));

const jwtSign = jest.fn();
const jwtVerify = jest.fn();

jest.unstable_mockModule("jsonwebtoken", () => ({
  __esModule: true,
  default: { sign: jwtSign, verify: jwtVerify },
  sign: jwtSign,
  verify: jwtVerify,
}));

type Service = typeof import("../../../src/modules/user/user.service.js");

let loginUser: Service["loginUser"];
let createUser: Service["createUser"];
let refreshAccessToken: Service["refreshAccessToken"];
let revokeRefreshToken: Service["revokeRefreshToken"];

const dbUser = {
  id: 1,
  username: "alice",
  email: "alice@example.com",
  password: "stored-hash",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  isAdmin: false,
};

function hashRefresh(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

beforeAll(async () => {
  const mod = await import("../../../src/modules/user/user.service.js");
  loginUser = mod.loginUser;
  createUser = mod.createUser;
  refreshAccessToken = mod.refreshAccessToken;
  revokeRefreshToken = mod.revokeRefreshToken;
});

describe("user.service", () => {
  beforeEach(() => {
    insertUser.mockReset();
    findUserByEmail.mockReset();
    findUserByUsername.mockReset();
    findUserById.mockReset();
    createUserSession.mockReset();
    findUserSessionByTokenHash.mockReset();
    deleteUserSessionById.mockReset();
    deleteUserSessionsByTokenHash.mockReset();
    bcryptCompare.mockReset();
    bcryptHash.mockReset();
    jwtSign.mockReset();
    jwtVerify.mockReset();
  });

  describe("loginUser", () => {
    it("authenticates when username matches and returns access + refresh", async () => {
      findUserByUsername.mockResolvedValue(dbUser);
      bcryptCompare.mockResolvedValue(true);
      jwtSign.mockReturnValue("access-jwt");
      createUserSession.mockResolvedValue({ id: "s1" });

      const out = await loginUser({
        loginString: "alice",
        password: "password123",
      });

      expect(findUserByUsername).toHaveBeenCalledWith("alice");
      expect(findUserByEmail).not.toHaveBeenCalled();
      expect(bcryptCompare).toHaveBeenCalledWith("password123", "stored-hash");
      expect(jwtSign).toHaveBeenCalledWith(
        { sub: "alice" },
        process.env.JWT_SECRET,
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(createUserSession).toHaveBeenCalledWith({
        userId: 1,
        tokenHash: hashRefresh(out.refreshToken),
        expiresAt: expect.any(Date),
      });
      expect(out.token).toBe("access-jwt");
      expect(out.refreshToken.length).toBeGreaterThan(20);
    });

    it("falls back to email when username does not match", async () => {
      findUserByUsername.mockResolvedValue(null);
      findUserByEmail.mockResolvedValue(dbUser);
      bcryptCompare.mockResolvedValue(true);
      jwtSign.mockReturnValue("tok2");
      createUserSession.mockResolvedValue({ id: "s2" });

      const out = await loginUser({
        loginString: "alice@example.com",
        password: "password123",
      });

      expect(findUserByUsername).toHaveBeenCalledWith("alice@example.com");
      expect(findUserByEmail).toHaveBeenCalledWith("alice@example.com");
      expect(out.token).toBe("tok2");
    });

    it("throws when neither username nor email resolves a user", async () => {
      findUserByUsername.mockResolvedValue(null);
      findUserByEmail.mockResolvedValue(null);

      await expect(loginUser({ loginString: "nobody", password: "password123" })).rejects.toThrow(
        "Invalid credentials",
      );

      expect(bcryptCompare).not.toHaveBeenCalled();
      expect(jwtSign).not.toHaveBeenCalled();
      expect(createUserSession).not.toHaveBeenCalled();
    });

    it("throws when password does not match", async () => {
      findUserByUsername.mockResolvedValue(dbUser);
      bcryptCompare.mockResolvedValue(false);

      await expect(loginUser({ loginString: "alice", password: "wrongpass12" })).rejects.toThrow(
        "Invalid credentials",
      );

      expect(jwtSign).not.toHaveBeenCalled();
      expect(createUserSession).not.toHaveBeenCalled();
    });
  });

  describe("refreshAccessToken", () => {
    it("throws when session is missing", async () => {
      findUserSessionByTokenHash.mockResolvedValue(null);
      await expect(refreshAccessToken("any")).rejects.toThrow("Invalid refresh token");
    });

    it("throws when session is expired", async () => {
      findUserSessionByTokenHash.mockResolvedValue({
        id: "sid",
        userId: 1,
        tokenHash: "h",
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });
      await expect(refreshAccessToken("raw")).rejects.toThrow("Invalid refresh token");
    });

    it("throws when user row is missing", async () => {
      const raw = "refresh-raw";
      findUserSessionByTokenHash.mockResolvedValue({
        id: "sid",
        userId: 1,
        tokenHash: hashRefresh(raw),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      });
      findUserById.mockResolvedValue(null);
      await expect(refreshAccessToken(raw)).rejects.toThrow("Invalid refresh token");
    });

    it("rotates refresh token and returns new pair", async () => {
      const raw = "valid-refresh-raw";
      findUserSessionByTokenHash.mockResolvedValue({
        id: "sid",
        userId: 1,
        tokenHash: hashRefresh(raw),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      });
      findUserById.mockResolvedValue(dbUser);
      jwtSign.mockReturnValue("new-access");
      deleteUserSessionById.mockResolvedValue({ id: "sid" });
      createUserSession.mockResolvedValue({ id: "snew" });

      const out = await refreshAccessToken(raw);

      expect(deleteUserSessionById).toHaveBeenCalledWith("sid");
      expect(jwtSign).toHaveBeenCalledWith(
        { sub: "alice" },
        process.env.JWT_SECRET,
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(createUserSession).toHaveBeenCalledWith({
        userId: 1,
        tokenHash: hashRefresh(out.refreshToken),
        expiresAt: expect.any(Date),
      });
      expect(out.token).toBe("new-access");
    });
  });

  describe("revokeRefreshToken", () => {
    it("deletes session rows for the hashed token", async () => {
      const raw = "to-revoke";
      deleteUserSessionsByTokenHash.mockResolvedValue({ count: 1 });
      await revokeRefreshToken(raw);
      expect(deleteUserSessionsByTokenHash).toHaveBeenCalledWith(hashRefresh(raw));
    });
  });

  describe("createUser", () => {
    it("hashes the password and delegates to insertUser", async () => {
      bcryptHash.mockResolvedValue("hashed-pw");
      const input = {
        username: "newu",
        email: "new@example.com",
        password: "longenough",
      };
      const created = {
        id: 9,
        username: "newu",
        email: "new@example.com",
        password: "hashed-pw",
        createdAt: new Date(),
        isAdmin: false,
      };
      insertUser.mockResolvedValue(created);

      const result = await createUser(input);

      expect(bcryptHash).toHaveBeenCalledWith("longenough", 10);
      expect(insertUser).toHaveBeenCalledWith({
        username: "newu",
        email: "new@example.com",
        password: "hashed-pw",
      });
      expect(result).toBe(created);
    });
  });
});
