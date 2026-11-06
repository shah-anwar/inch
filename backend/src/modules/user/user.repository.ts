import { prisma } from "@db/prisma.js";
import type { User } from "@inch/types";

/**
 * Inserts a new user row.
 *
 * @param user Validated user input (password expected to be already hashed).
 * @returns Created user record.
 */
export async function insertUser(user: User.CreateUserInput) {
  return prisma.user.create({
    data: {
      username: user.username,
      email: user.email,
      password: user.password,
    },
  });
}

/** Finds a user by unique email address. */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Finds a user by unique username. */
export async function findUserByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

/** Finds a user by primary key. */
export async function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

/** Updates a user's password hash by id. */
export async function updateUserPasswordById(id: number, passwordHash: string) {
  return prisma.user.update({
    where: { id },
    data: { password: passwordHash },
  });
}

/** Lists arguments authored by one user, newest first, with topic/subtopic context. */
export async function listArgumentsByAuthor(authorId: number) {
  return prisma.argument.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      argumentText: true,
      schemeId: true,
      status: true,
      isInitial: true,
      createdAt: true,
      subtopicId: true,
      subtopic: {
        select: {
          id: true,
          title: true,
          topic: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });
}
