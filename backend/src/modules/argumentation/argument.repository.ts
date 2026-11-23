import { prisma } from "@db/prisma.js";
import type { CreateInitialArgument, CreateCounterArgument } from "@inch/types";
import { init } from "@paralleldrive/cuid2";

const createId = init({ length: 24 });

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Inserts a new root argument attached to a subtopic.
 *
 * @param data Validated initial argument payload.
 * @param authorId Submitting user id.
 * @returns Created argument including variable rows.
 */
export async function createInitialArgument(
  data: CreateInitialArgument & { argumentText: string },
  authorId: number,
) {
  const id = createId();

  return prisma.$transaction(async (tx) => {
    const argument = await tx.argument.create({
      data: {
        id,
        schemeId: data.schemeId,
        argumentText: data.argumentText,
        isInitial: true,
        parentId: null,
        parentType: "SUBTOPIC",
        subtopicId: data.subtopicId,
        status: "UNDECIDED",
        childIds: [],
        descendantCount: 0,
        authorId,
        variables: {
          create: data.variables.map((v) => ({
            variableId: v.variableId,
            value: v.value,
          })),
        },
      },
      include: { variables: true },
    });

    return argument;
  });
}

/**
 * Inserts a counter-argument and updates parent/ancestor descendant counters.
 *
 * Side effects:
 * - Appends new id to parent `childIds`.
 * - Increments `descendantCount` for all ancestors.
 *
 * @param data Validated counter-argument payload.
 * @param authorId Submitting user id.
 * @returns Created counter-argument including variable rows.
 * @throws {Error} When the parent argument does not exist.
 */
export async function createCounterArgument(
  data: CreateCounterArgument & { argumentText: string },
  authorId: number,
) {
  const id = createId();

  const parent = await prisma.argument.findUnique({
    where: { id: data.parentArgumentId },
    select: {
      id: true,
      subtopicId: true,
      schemeId: true,
      childIds: true,
      descendantCount: true,
      parentId: true,
      isInitial: true,
    },
  });

  if (!parent) {
    throw new Error(`Parent argument ${data.parentArgumentId} not found`);
  }

  return prisma.$transaction(async (tx) => {
    const argument = await tx.argument.create({
      data: {
        id,
        schemeId: data.schemeId,
        selectedCqId: data.selectedCqId,
        argumentText: data.argumentText,
        isInitial: false,
        parentId: data.parentArgumentId,
        parentType: "ARGUMENT",
        subtopicId: parent.subtopicId,
        status: "UNDECIDED",
        childIds: [],
        descendantCount: 0,
        authorId,
        variables: {
          create: data.variables.map((v) => ({
            variableId: v.variableId,
            value: v.value,
          })),
        },
      },
      include: { variables: true },
    });

    await tx.argument.update({
      where: { id: data.parentArgumentId },
      data: {
        childIds: { push: id },
      },
    });

    await incrementDescendantCounts(tx, data.parentArgumentId);

    return argument;
  });
}

async function incrementDescendantCounts(tx: TransactionClient, startId: string): Promise<void> {
  let currentId: string | null = startId;

  while (currentId !== null) {
    const arg: { parentId: string | null } | null = await tx.argument.findUnique({
      where: { id: currentId },
      select: { parentId: true, descendantCount: true },
    });

    if (!arg) break;

    await tx.argument.update({
      where: { id: currentId },
      data: { descendantCount: { increment: 1 } },
    });

    currentId = arg.parentId;
  }
}

/**
 * Fetches one argument with its variables.
 *
 * @param id Argument identifier.
 * @returns Argument record or `null` when missing.
 */
export async function getArgumentById(id: string) {
  return prisma.argument.findUnique({
    where: { id },
    include: { variables: true },
  });
}

/** Fetches all arguments for one subtopic in creation order. */
export async function getArgumentsBySubtopic(subtopicId: number) {
  return prisma.argument.findMany({
    where: { subtopicId },
    include: { variables: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Increments the view counter for an argument.
 *
 * @param argumentId Argument identifier.
 * @returns Promise resolving after the DB update.
 */
export async function incrementViewCount(argumentId: string): Promise<void> {
  await prisma.argument.update({
    where: { id: argumentId },
    data: { viewCount: { increment: 1 } },
  });
}

// ---------------------------------------------------------------------------
// New queries for enriched argument, context, ancestors, children
// ---------------------------------------------------------------------------

/**
 * Fetches status values for a set of direct child argument ids.
 *
 * @param childIds Child argument ids.
 * @returns Rows containing `id` and `status` for matching arguments.
 */
export async function getChildStatuses(childIds: string[]) {
  if (childIds.length === 0) return [];
  return prisma.argument.findMany({
    where: { id: { in: childIds } },
    select: { id: true, status: true },
  });
}

/** Fetches an argument plus subtopic/topic context for breadcrumb rendering. */
export async function getArgumentWithSubtopicAndTopic(id: string) {
  return prisma.argument.findUnique({
    where: { id },
    include: {
      variables: true,
      subtopic: {
        include: { topic: true },
      },
    },
  });
}

/** Fetches the minimal ancestor-node shape needed for chain traversal. */
export async function getAncestorNode(id: string) {
  return prisma.argument.findUnique({
    where: { id },
    select: {
      id: true,
      schemeId: true,
      argumentText: true,
      isInitial: true,
      status: true,
      parentId: true,
    },
  });
}

/**
 * Retrieves children of a parent argument with cursor pagination options.
 *
 * @param parentId Parent argument identifier.
 * @param options Sort/pagination controls mapped to Prisma query options.
 * @returns Child arguments including variables.
 */
export async function getChildrenByParent(
  parentId: string,
  options: {
    orderBy: Record<string, string> | Record<string, string>[];
    take: number;
    cursor?: string;
  },
) {
  return prisma.argument.findMany({
    where: { parentId },
    include: { variables: true },
    orderBy: options.orderBy,
    take: options.take,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
}

/** Fetches every direct child of a parent argument without pagination. */
export async function getAllChildrenByParent(parentId: string) {
  return prisma.argument.findMany({
    where: { parentId },
    include: { variables: true },
  });
}

/** Checks whether an argument exists. */
export async function argumentExists(id: string) {
  const row = await prisma.argument.findUnique({
    where: { id },
    select: { id: true },
  });
  return row !== null;
}
