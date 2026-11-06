import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import { buildPrismaMock, resetPrismaMock } from "../../setup/mocks/prisma.js";

const prisma = buildPrismaMock();

jest.unstable_mockModule("@db/prisma.js", () => ({
  prisma,
}));

type Repo = typeof import("../../../src/modules/user/user.repository.js");

let insertUser: Repo["insertUser"];
let findUserByEmail: Repo["findUserByEmail"];
let findUserByUsername: Repo["findUserByUsername"];
let findUserById: Repo["findUserById"];

beforeAll(async () => {
  const mod = await import("../../../src/modules/user/user.repository.js");
  insertUser = mod.insertUser;
  findUserByEmail = mod.findUserByEmail;
  findUserByUsername = mod.findUserByUsername;
  findUserById = mod.findUserById;
});

describe("user.repository", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
  });

  describe("insertUser", () => {
    it("calls prisma.user.create with hashed user fields and returns the row", async () => {
      const input = {
        username: "alice",
        email: "alice@example.com",
        password: "hashed-secret",
      };
      const created = {
        id: 1,
        ...input,
        createdAt: new Date(),
        isAdmin: false,
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await insertUser(input);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: "alice",
          email: "alice@example.com",
          password: "hashed-secret",
        },
      });
      expect(result).toBe(created);
    });
  });

  describe("findUserByEmail", () => {
    it("calls prisma.user.findUnique with email where clause", async () => {
      const row = { id: 2, username: "bob", email: "b@e.com" };
      prisma.user.findUnique.mockResolvedValue(row);

      const result = await findUserByEmail("b@e.com");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "b@e.com" },
      });
      expect(result).toBe(row);
    });
  });

  describe("findUserByUsername", () => {
    it("calls prisma.user.findUnique with username where clause", async () => {
      const row = { id: 3, username: "carol", email: "c@e.com" };
      prisma.user.findUnique.mockResolvedValue(row);

      const result = await findUserByUsername("carol");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: "carol" },
      });
      expect(result).toBe(row);
    });
  });

  describe("findUserById", () => {
    it("calls prisma.user.findUnique with id where clause", async () => {
      const row = { id: 5, username: "dave", email: "d@e.com" };
      prisma.user.findUnique.mockResolvedValue(row);

      const result = await findUserById(5);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(result).toBe(row);
    });
  });
});
