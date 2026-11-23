import { prisma } from "@db/prisma.js";

export async function createUserSession(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  return prisma.userSession.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    },
  });
}

export async function findUserSessionByTokenHash(tokenHash: string) {
  return prisma.userSession.findUnique({ where: { tokenHash } });
}

export async function deleteUserSessionById(id: string) {
  return prisma.userSession.delete({ where: { id } });
}

export async function deleteUserSessionsByTokenHash(tokenHash: string) {
  return prisma.userSession.deleteMany({ where: { tokenHash } });
}
