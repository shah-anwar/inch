import { prisma } from "@db/prisma.js";
import type {
  AdminScheme,
  AdminCriticalQuestion,
  CreateScheme,
  UpdateScheme,
  CreateCriticalQuestion,
  UpdateCriticalQuestion,
  ActiveSchemesResponse,
  SetActiveSchemes,
  PromoteUserToAdmin,
  PromoteUserToAdminResponse,
} from "@inch/types";

/** Maps Prisma critical-question rows to admin API contract. */
function mapCriticalQuestion(cq: {
  id: string;
  schemeId: string;
  text: string;
  description: string;
  validResponseSchemeIds: string[];
}): AdminCriticalQuestion {
  return {
    id: cq.id,
    schemeId: cq.schemeId,
    text: cq.text,
    description: cq.description,
    validResponseSchemeIds: cq.validResponseSchemeIds,
  };
}

/** Maps Prisma scheme rows (with nested CQs) to admin API contract. */
function mapScheme(scheme: {
  id: string;
  name: string;
  description: string;
  conclusion: string;
  variables: unknown;
  createdAt: Date;
  criticalQuestions: {
    id: string;
    schemeId: string;
    text: string;
    description: string;
    validResponseSchemeIds: string[];
  }[];
}): AdminScheme {
  return {
    id: scheme.id,
    name: scheme.name,
    description: scheme.description,
    conclusion: scheme.conclusion,
    variables: scheme.variables,
    createdAt: scheme.createdAt.toISOString(),
    criticalQuestions: scheme.criticalQuestions.map(mapCriticalQuestion),
  };
}

/** Returns all schemes for admin management views. */
export async function listAdminSchemes(): Promise<AdminScheme[]> {
  const schemes = await prisma.scheme.findMany({
    include: {
      criticalQuestions: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return schemes.map(mapScheme);
}

/**
 * Retrieves one scheme by id for admin editing flows.
 *
 * @param id Scheme identifier.
 * @returns Scheme payload, or `null` when missing.
 */
export async function getAdminSchemeById(id: string): Promise<AdminScheme | null> {
  const scheme = await prisma.scheme.findUnique({
    where: { id },
    include: {
      criticalQuestions: true,
    },
  });

  if (!scheme) {
    return null;
  }

  return mapScheme(scheme);
}

/**
 * Creates a new scheme after enforcing id uniqueness.
 *
 * @param data Validated scheme creation payload.
 * @returns Newly created scheme record with nested CQs.
 * @throws {Error} `SCHEME_ID_EXISTS` when id is already taken.
 */
export async function createAdminScheme(data: CreateScheme): Promise<AdminScheme> {
  const existing = await prisma.scheme.findUnique({
    where: { id: data.id },
    select: { id: true },
  });

  if (existing) {
    throw new Error("SCHEME_ID_EXISTS");
  }

  const scheme = await prisma.scheme.create({
    data: {
      id: data.id,
      name: data.name,
      description: data.description,
      conclusion: data.conclusion,
      variables: data.variables,
    },
    include: {
      criticalQuestions: true,
    },
  });

  return mapScheme(scheme);
}

/**
 * Applies partial updates to an existing scheme.
 *
 * @param id Scheme id.
 * @param data Patch payload.
 * @returns Updated scheme or `null` when target does not exist.
 */
export async function updateAdminScheme(
  id: string,
  data: UpdateScheme,
): Promise<AdminScheme | null> {
  const existing = await prisma.scheme.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const scheme = await prisma.scheme.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      description: data.description ?? undefined,
      conclusion: data.conclusion ?? undefined,
      variables: data.variables ?? undefined,
    },
    include: {
      criticalQuestions: true,
    },
  });

  return mapScheme(scheme);
}

/**
 * Lists critical questions for a given scheme id.
 *
 * @param schemeId Parent scheme id.
 * @returns Critical-question list, or `null` when scheme is missing.
 */
export async function listAdminCriticalQuestionsForScheme(
  schemeId: string,
): Promise<AdminCriticalQuestion[] | null> {
  const scheme = await prisma.scheme.findUnique({
    where: { id: schemeId },
    select: { id: true },
  });

  if (!scheme) {
    return null;
  }

  const cqs = await prisma.criticalQuestion.findMany({
    where: { schemeId },
    orderBy: { id: "asc" },
  });

  return cqs.map(mapCriticalQuestion);
}

/**
 * Creates a critical question under an existing scheme.
 *
 * @param schemeId Parent scheme id.
 * @param data CQ creation payload.
 * @returns Created critical question.
 * @throws {Error} `SCHEME_NOT_FOUND` or `CQ_ID_EXISTS`.
 */
export async function createAdminCriticalQuestion(
  schemeId: string,
  data: CreateCriticalQuestion,
): Promise<AdminCriticalQuestion> {
  const scheme = await prisma.scheme.findUnique({
    where: { id: schemeId },
    select: { id: true },
  });

  if (!scheme) {
    throw new Error("SCHEME_NOT_FOUND");
  }

  const existing = await prisma.criticalQuestion.findUnique({
    where: { id: data.id },
    select: { id: true },
  });

  if (existing) {
    throw new Error("CQ_ID_EXISTS");
  }

  const cq = await prisma.criticalQuestion.create({
    data: {
      id: data.id,
      schemeId,
      text: data.text,
      description: data.description,
      validResponseSchemeIds: data.validResponseSchemeIds,
    },
  });

  return mapCriticalQuestion(cq);
}

/** Fetches one critical question by id for admin edit checks. */
export async function getAdminCriticalQuestionById(
  id: string,
): Promise<AdminCriticalQuestion | null> {
  const cq = await prisma.criticalQuestion.findUnique({
    where: { id },
  });

  if (!cq) {
    return null;
  }

  return mapCriticalQuestion(cq);
}

/**
 * Applies partial updates to a critical question.
 *
 * @param id Critical-question id.
 * @param data Patch payload.
 * @returns Updated CQ, or `null` when missing.
 */
export async function updateAdminCriticalQuestion(
  id: string,
  data: UpdateCriticalQuestion,
): Promise<AdminCriticalQuestion | null> {
  const existing = await prisma.criticalQuestion.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const cq = await prisma.criticalQuestion.update({
    where: { id },
    data: {
      validResponseSchemeIds: data.validResponseSchemeIds,
    },
  });

  return mapCriticalQuestion(cq);
}

/**
 * Filters input ids to those that do not exist as scheme ids.
 *
 * @param ids Candidate scheme ids.
 * @returns Invalid ids in original order.
 */
export async function findInvalidSchemeIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const schemes = await prisma.scheme.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
    },
  });

  const existing = new Set(schemes.map((s) => s.id));
  return ids.filter((id) => !existing.has(id));
}

/** Returns the current set of active scheme ids. */
export async function listActiveSchemeIds(): Promise<ActiveSchemesResponse> {
  const activeSchemes = await prisma.activeScheme.findMany({
    orderBy: { schemeId: "asc" },
    select: { schemeId: true },
  });
  return { activeSchemeIds: activeSchemes.map((row) => row.schemeId) };
}

/**
 * Replaces the full active scheme set in one transaction.
 *
 * @throws {Error} `INVALID_SCHEME_IDS` when payload includes unknown ids.
 */
export async function setActiveSchemeIds(
  payload: SetActiveSchemes,
): Promise<ActiveSchemesResponse> {
  const invalidIds = await findInvalidSchemeIds(payload.activeSchemeIds);
  if (invalidIds.length > 0) {
    throw new Error(`INVALID_SCHEME_IDS:${invalidIds.join(",")}`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.activeScheme.deleteMany({});

    if (payload.activeSchemeIds.length > 0) {
      await tx.activeScheme.createMany({
        data: payload.activeSchemeIds.map((schemeId) => ({ schemeId })),
      });
    }

    const activeSchemes = await tx.activeScheme.findMany({
      orderBy: { schemeId: "asc" },
      select: { schemeId: true },
    });

    return { activeSchemeIds: activeSchemes.map((row) => row.schemeId) };
  });
}

/** Promotes a user to admin by username and reports outcome status. */
export async function promoteUserToAdmin(
  payload: PromoteUserToAdmin,
): Promise<PromoteUserToAdminResponse> {
  const user = await prisma.user.findUnique({
    where: { username: payload.username },
    select: { username: true, isAdmin: true },
  });

  if (!user) {
    return { username: payload.username, status: "not_found" };
  }

  if (user.isAdmin) {
    return { username: user.username, status: "already_admin" };
  }

  await prisma.user.update({
    where: { username: payload.username },
    data: { isAdmin: true },
  });

  return { username: payload.username, status: "promoted" };
}
