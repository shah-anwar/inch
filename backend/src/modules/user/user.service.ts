import crypto from "node:crypto";
import type { User } from "@inch/types";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import {
  createUserSession,
  deleteUserSessionById,
  deleteUserSessionsByTokenHash,
  findUserSessionByTokenHash,
} from "./user-session.repository.js";
import {
  insertUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  listArgumentsByAuthor,
  updateUserPasswordById,
} from "./user.repository.js";

const JWT_SECRET = process.env.JWT_SECRET!;

const REFRESH_IDLE_DAYS = Number(process.env.REFRESH_IDLE_DAYS ?? 90);
const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES ?? "15m";

// jsonwebtoken types expiresIn as a number or an ms-style string ("15m", "1h"),
// not a plain string. The env value is passed through unchanged; an invalid one
// still fails at sign time, as before.
type AccessTokenExpiry = SignOptions["expiresIn"];

function hashRefreshToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function newRefreshTokenRaw() {
  return crypto.randomBytes(48).toString("base64url");
}

function refreshExpiryDate() {
  const ms = REFRESH_IDLE_DAYS * 86_400_000;
  return new Date(Date.now() + ms);
}

export type LoginTokens = { token: string; refreshToken: string };

/**
 * Authenticates a user and returns a short-lived access JWT plus a long-lived refresh token.
 * The refresh token is stored hashed; it expires after a sliding idle period (see REFRESH_IDLE_DAYS).
 */
export async function loginUser(input: User.LoginUserInput): Promise<LoginTokens> {
  const user =
    (await findUserByUsername(input.loginString)) ?? (await findUserByEmail(input.loginString));

  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  const token = jwt.sign({ sub: user.username }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES as AccessTokenExpiry,
  });
  const refreshToken = newRefreshTokenRaw();
  await createUserSession({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshExpiryDate(),
  });
  return { token, refreshToken };
}

/**
 * Exchanges a valid refresh token for new access and refresh tokens (rotation).
 */
export async function refreshAccessToken(rawRefresh: string): Promise<LoginTokens> {
  const session = await findUserSessionByTokenHash(hashRefreshToken(rawRefresh));
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw new Error("Invalid refresh token");
  }

  const user = await findUserById(session.userId);
  if (!user) throw new Error("Invalid refresh token");

  const token = jwt.sign({ sub: user.username }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES as AccessTokenExpiry,
  });
  const refreshToken = newRefreshTokenRaw();
  const expiresAt = refreshExpiryDate();

  await deleteUserSessionById(session.id);
  await createUserSession({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt,
  });

  return { token, refreshToken };
}

/** Revokes a single browser/device session. */
export async function revokeRefreshToken(rawRefresh: string) {
  await deleteUserSessionsByTokenHash(hashRefreshToken(rawRefresh));
}

/**
 * Creates a new user after hashing the supplied password.
 *
 * @param input User registration payload.
 * @returns Newly created user record.
 */
export async function createUser(input: User.CreateUserInput) {
  const hashedPassword = await bcrypt.hash(input.password, 10);
  return insertUser({ ...input, password: hashedPassword });
}

/** Returns authored arguments for profile screens. */
export async function getUserArguments(userId: number) {
  const rows = await listArgumentsByAuthor(userId);
  return rows.map((row) => ({
    id: row.id,
    argumentText: row.argumentText,
    schemeId: row.schemeId,
    status: row.status,
    isInitial: row.isInitial,
    createdAt: row.createdAt,
    subtopicId: row.subtopicId,
    subtopicTitle: row.subtopic.title,
    topicId: row.subtopic.topic.id,
    topicTitle: row.subtopic.topic.title,
  }));
}

/** Changes password after verifying the current password. */
export async function changeUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
) {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error("Current password is incorrect");

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await updateUserPasswordById(userId, newPasswordHash);
}
