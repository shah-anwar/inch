import { prisma } from "@db/prisma.js";
import { CriticalQuestionSchema, SchemeSchema } from "@inch/types";
import type {
  CreateInitialArgument,
  CreateCounterArgument,
  ChildrenByStatus,
  ChildrenSort,
  AncestorNode,
  GenerateArgumentTextRequest,
  ArgumentCreatedPayload,
} from "@inch/types";
import {
  createInitialArgument,
  createCounterArgument,
  getArgumentById,
  getArgumentsBySubtopic,
  getChildStatuses,
  getArgumentWithSubtopicAndTopic,
  getAncestorNode,
  getChildrenByParent,
  getAllChildrenByParent,
  argumentExists,
  incrementViewCount,
} from "./argument.repository.js";
import { generateArgumentTextVariations } from "./llm/argument-text.js";
import {
  moderateArgumentSubmission,
  moderateVariableInputs,
  ModerationFailedError,
} from "./llm/moderation.js";
import { releaseTextPreview, validateAndConsumeTextPreview } from "./llm/text-preview-store.js";
import { getRedisClient } from "../../cache/redis.js";
import { evaluationQueue } from "../../queue/evaluationQueue.js";
import {
  allowsResponseScheme,
  getVisibleCriticalQuestions,
  getVisibleSchemes,
} from "../../utils/activeSchemes.js";
import { emitToRoom, getSubtopicRoom } from "../../websocket/ws.js";

type PublicScheme = {
  id: string;
  name: string;
  description: string;
  conclusion: string;
  variables: {
    id: string;
    name: string;
    description: string;
    placeholder: string;
    required: boolean;
    type: "string" | "entity" | "claim";
  }[];
  criticalQuestions: {
    id: string;
    text: string;
    description: string;
    validResponseSchemeIds: string[];
  }[];
};

function readSchemeVariables(rawVariables: unknown): PublicScheme["variables"] {
  if (!Array.isArray(rawVariables)) {
    return [];
  }

  return rawVariables
    .map((rawVariable) => {
      if (rawVariable == null || typeof rawVariable !== "object") {
        return null;
      }
      const variable = rawVariable as {
        id?: unknown;
        name?: unknown;
        description?: unknown;
        placeholder?: unknown;
        required?: unknown;
        type?: unknown;
      };

      if (
        typeof variable.id !== "string" ||
        typeof variable.name !== "string" ||
        typeof variable.description !== "string" ||
        typeof variable.placeholder !== "string"
      ) {
        return null;
      }

      if (variable.type !== "string" && variable.type !== "entity" && variable.type !== "claim") {
        return null;
      }

      return {
        id: variable.id,
        name: variable.name,
        description: variable.description,
        placeholder: variable.placeholder,
        required: Boolean(variable.required),
        type: variable.type,
      };
    })
    .filter((variable): variable is PublicScheme["variables"][number] => variable !== null);
}

async function getActiveSchemeIds(): Promise<string[]> {
  const rows = await prisma.activeScheme.findMany({
    select: { schemeId: true },
  });
  return rows.map((row) => row.schemeId);
}

async function getAllSchemesWithCqs(): Promise<PublicScheme[]> {
  const schemes = await prisma.scheme.findMany({
    include: { criticalQuestions: true },
    orderBy: { id: "asc" },
  });

  return schemes.map((scheme) => {
    return {
      id: scheme.id,
      name: scheme.name,
      description: scheme.description,
      conclusion: scheme.conclusion,
      variables: readSchemeVariables(scheme.variables),
      criticalQuestions: scheme.criticalQuestions.map((cq) =>
        CriticalQuestionSchema.parse({
          id: cq.id,
          text: cq.text,
          description: cq.description,
          validResponseSchemeIds: cq.validResponseSchemeIds,
        }),
      ),
    };
  });
}

async function getSchemeWithCqsById(schemeId: string): Promise<PublicScheme | null> {
  const scheme = await prisma.scheme.findUnique({
    where: { id: schemeId },
    include: { criticalQuestions: true },
  });
  if (!scheme) {
    return null;
  }

  return {
    id: scheme.id,
    name: scheme.name,
    description: scheme.description,
    conclusion: scheme.conclusion,
    variables: readSchemeVariables(scheme.variables),
    criticalQuestions: scheme.criticalQuestions.map((cq) =>
      CriticalQuestionSchema.parse({
        id: cq.id,
        text: cq.text,
        description: cq.description,
        validResponseSchemeIds: cq.validResponseSchemeIds,
      }),
    ),
  };
}

/**
 * Validates and persists an initial argument, then enqueues status evaluation.
 *
 * @param data Validated initial argument payload.
 * @param authorId Authenticated user id submitting the argument.
 * @returns Newly created argument record.
 * @throws {Error} When scheme, variables, moderation, preview token, or subtopic validation fails.
 */
export async function submitInitialArgument(data: CreateInitialArgument, authorId: number) {
  const [scheme, activeSchemeIds] = await Promise.all([
    getSchemeWithCqsById(data.schemeId),
    getActiveSchemeIds(),
  ]);
  if (!scheme) throw new Error(`Unknown scheme: ${data.schemeId}`);
  if (!activeSchemeIds.includes(data.schemeId)) {
    throw new Error(`Scheme ${data.schemeId} is not currently active`);
  }

  validateVariables(scheme, data.variables);
  const argumentText = await validateAndConsumeTextPreview({
    token: data.textPreviewToken,
    request: {
      kind: "initial",
      subtopicId: data.subtopicId,
      schemeId: data.schemeId,
      variables: data.variables,
    },
    selectedOptionId: data.selectedOptionId,
    userId: String(authorId),
  });
  await assertTextSubmissionAllowed(argumentText);

  const subtopic = await prisma.subtopic.findUnique({
    where: { id: data.subtopicId },
  });
  if (!subtopic) throw new Error(`Subtopic ${data.subtopicId} not found`);

  const argument = await createInitialArgument({ ...data, argumentText }, authorId);

  await invalidateGraphCachesAfterCreate({
    subtopicId: data.subtopicId,
    argumentId: argument.id,
    parentId: null,
  });
  emitArgumentCreated({
    subtopicId: data.subtopicId,
    argumentId: argument.id,
    parentId: null,
  });

  await evaluationQueue.add(
    `eval:${argument.id}`,
    { subtopicId: data.subtopicId, newArgumentId: argument.id },
    { jobId: `subtopic:${data.subtopicId}:${argument.id}` },
  );

  return argument;
}

/**
 * Validates and persists a counter-argument against an existing parent argument.
 *
 * @param data Validated counter-argument payload.
 * @param authorId Authenticated user id submitting the argument.
 * @returns Newly created counter-argument record.
 * @throws {Error} When parent/CQ/scheme constraints, moderation, or preview validation fails.
 */
export async function submitCounterArgument(data: CreateCounterArgument, authorId: number) {
  const [scheme, activeSchemeIds] = await Promise.all([
    getSchemeWithCqsById(data.schemeId),
    getActiveSchemeIds(),
  ]);
  if (!scheme) throw new Error(`Unknown scheme: ${data.schemeId}`);
  if (!activeSchemeIds.includes(data.schemeId)) {
    throw new Error(`Scheme ${data.schemeId} is not currently active`);
  }

  validateVariables(scheme, data.variables);
  const argumentText = await validateAndConsumeTextPreview({
    token: data.textPreviewToken,
    request: {
      kind: "counter",
      parentArgumentId: data.parentArgumentId,
      selectedCqId: data.selectedCqId,
      schemeId: data.schemeId,
      variables: data.variables,
    },
    selectedOptionId: data.selectedOptionId,
    userId: String(authorId),
  });
  await assertTextSubmissionAllowed(argumentText);

  const parent = await getArgumentById(data.parentArgumentId);
  if (!parent) throw new Error(`Parent argument not found`);

  const parentScheme = await getSchemeWithCqsById(parent.schemeId);
  const cq = parentScheme?.criticalQuestions.find(
    (criticalQuestion) => criticalQuestion.id === data.selectedCqId,
  );
  if (!cq) {
    throw new Error(`CQ ${data.selectedCqId} does not belong to scheme ${parent.schemeId}`);
  }

  const isValidResponseScheme = allowsResponseScheme(cq, data.schemeId);
  if (!isValidResponseScheme) {
    throw new Error(`Scheme ${data.schemeId} is not a valid response to CQ ${data.selectedCqId}`);
  }

  const argument = await createCounterArgument({ ...data, argumentText }, authorId);

  await invalidateGraphCachesAfterCreate({
    subtopicId: argument.subtopicId,
    argumentId: argument.id,
    parentId: data.parentArgumentId,
  });
  emitArgumentCreated({
    subtopicId: argument.subtopicId,
    argumentId: argument.id,
    parentId: data.parentArgumentId,
  });

  await evaluationQueue.add(
    `eval:${argument.id}`,
    { subtopicId: argument.subtopicId, newArgumentId: argument.id },
    { jobId: `subtopic:${argument.subtopicId}:${argument.id}` },
  );

  return argument;
}

/**
 * Generates natural-language preview options from a structured argument draft.
 *
 * @param request Preview request describing initial/counter context and variables.
 * @returns Preview token and generated text options.
 * @throws {Error} When the scheme is unknown or required variables are missing.
 */
export async function previewArgumentText(request: GenerateArgumentTextRequest, userId: number) {
  const [scheme, activeSchemeIds] = await Promise.all([
    getSchemeWithCqsById(request.schemeId),
    getActiveSchemeIds(),
  ]);
  if (!scheme) {
    throw new Error(`Unknown scheme: ${request.schemeId}`);
  }
  if (!activeSchemeIds.includes(request.schemeId)) {
    throw new Error(`Scheme ${request.schemeId} is not currently active`);
  }

  if (request.kind === "counter") {
    const parent = await getArgumentById(request.parentArgumentId);
    if (!parent) {
      throw new Error("Parent argument not found");
    }

    const parentScheme = await getSchemeWithCqsById(parent.schemeId);
    const cq = parentScheme?.criticalQuestions.find(
      (criticalQuestion) => criticalQuestion.id === request.selectedCqId,
    );
    if (!cq) {
      throw new Error(`CQ ${request.selectedCqId} does not belong to scheme ${parent.schemeId}`);
    }

    if (!allowsResponseScheme(cq, request.schemeId)) {
      throw new Error(
        `Scheme ${request.schemeId} is not a valid response to CQ ${request.selectedCqId}`,
      );
    }
  }

  validateVariables(scheme, request.variables);

  const variablesForMod = buildVariablesWithLabels(scheme, request.variables);
  const mod = await moderateVariableInputs({
    schemeId: scheme.id,
    schemeName: scheme.name,
    conclusionTemplate: scheme.conclusion,
    variables: variablesForMod,
  });
  if (!mod.passed) {
    throw new ModerationFailedError(mod.violations);
  }

  return generateArgumentTextVariations(request, String(userId));
}

/** Returns active schemes for initial argument creation. */
export async function listInitialArgumentSchemes() {
  const [allSchemes, activeSchemeIds] = await Promise.all([
    getAllSchemesWithCqs(),
    getActiveSchemeIds(),
  ]);
  const activeSet = new Set(activeSchemeIds);
  return allSchemes
    .filter((scheme) => activeSet.has(scheme.id))
    .map((scheme) => SchemeSchema.parse(scheme));
}

/** Returns visible critical questions for the target argument's scheme. */
export async function listVisibleCriticalQuestionsForArgument(argumentId: string) {
  const argument = await getArgumentById(argumentId);
  if (!argument) return null;

  const [parentScheme, activeSchemeIds] = await Promise.all([
    getSchemeWithCqsById(argument.schemeId),
    getActiveSchemeIds(),
  ]);
  if (!parentScheme) return null;

  return getVisibleCriticalQuestions(activeSchemeIds, parentScheme.criticalQuestions).map((cq) =>
    CriticalQuestionSchema.parse(cq),
  );
}

/** Returns active response schemes for a specific critical question on an argument. */
export async function listVisibleResponseSchemesForArgumentCq(argumentId: string, cqId: string) {
  const argument = await getArgumentById(argumentId);
  if (!argument) return null;

  const [parentScheme, allSchemes, activeSchemeIds] = await Promise.all([
    getSchemeWithCqsById(argument.schemeId),
    getAllSchemesWithCqs(),
    getActiveSchemeIds(),
  ]);
  if (!parentScheme) return null;

  const cq = parentScheme.criticalQuestions.find(
    (criticalQuestion) => criticalQuestion.id === cqId,
  );
  if (!cq) return null;

  return getVisibleSchemes(activeSchemeIds, allSchemes)
    .filter((scheme) => allowsResponseScheme(cq, scheme.id))
    .map((scheme) => SchemeSchema.parse(scheme));
}

/**
 * Releases a previously issued preview token.
 *
 * @param previewToken Preview token to invalidate.
 * @returns Promise that resolves when release is complete.
 */
export async function discardArgumentTextPreview(previewToken: string, userId: number) {
  await releaseTextPreview(previewToken, String(userId));
}

const SUBTOPIC_GRAPH_TTL = 60; // seconds
const ARGUMENT_TTL = 30; // seconds

/**
 * Returns all arguments in a subtopic enriched with grouped child-status buckets.
 *
 * Side effects: may read/write Redis cache when available.
 *
 * @param subtopicId Subtopic identifier.
 * @returns Enriched argument list for graph rendering.
 */
export async function getSubtopicGraph(subtopicId: number) {
  const redis = getRedisClient();
  const cacheKey = `subtopic:${subtopicId}:arguments`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // cache read failure — fall through to DB
    }
  }

  const arguments_ = await getArgumentsBySubtopic(subtopicId);
  if (arguments_.length === 0) return [];

  const allChildIds = [...new Set(arguments_.flatMap((a) => a.childIds))];
  const childStatuses = await getChildStatuses(allChildIds);
  const statusMap = new Map(childStatuses.map((c) => [c.id, c.status]));

  const result = arguments_.map((argument) => {
    const childrenByStatus = groupByStatus(argument.childIds, statusMap);
    return { ...argument, childrenByStatus };
  });

  if (redis) {
    redis.set(cacheKey, JSON.stringify(result), "EX", SUBTOPIC_GRAPH_TTL).catch(() => {});
  }

  return result;
}

function validateVariables(
  scheme: { variables: { id: string; required: boolean }[] },
  provided: { variableId: string; value: string }[],
) {
  const providedMap = new Map(provided.map((v) => [v.variableId, v.value]));

  for (const variable of scheme.variables) {
    if (variable.required && !providedMap.get(variable.id)?.trim()) {
      throw new Error(`Required variable "${variable.id}" is missing or empty`);
    }
  }
}

function buildVariablesWithLabels(
  scheme: PublicScheme,
  provided: { variableId: string; value: string }[],
): Array<{ variableId: string; label: string; value: string }> {
  const byId = new Map(scheme.variables.map((v) => [v.id, v]));
  return provided.map((p) => {
    const def = byId.get(p.variableId);
    return {
      variableId: p.variableId,
      label: def?.name ?? p.variableId,
      value: p.value,
    };
  });
}

async function assertTextSubmissionAllowed(argumentText: string) {
  const result = await moderateArgumentSubmission(argumentText);
  if (!result.allowed) {
    throw new Error(result.reason ?? "Argument text failed moderation");
  }
}

// ---------------------------------------------------------------------------
// Enriched argument, context, ancestors, children
// ---------------------------------------------------------------------------

function groupByStatus(childIds: string[], statusMap: Map<string, string>): ChildrenByStatus {
  const result: ChildrenByStatus = { in: [], undecided: [], out: [] };
  for (const id of childIds) {
    const s = statusMap.get(id);
    if (s === "IN") result.in.push(id);
    else if (s === "OUT") result.out.push(id);
    else result.undecided.push(id);
  }
  return result;
}

async function invalidateGraphCachesAfterCreate({
  subtopicId,
  argumentId,
  parentId,
}: {
  subtopicId: number;
  argumentId: string;
  parentId: string | null;
}) {
  const redis = getRedisClient();
  if (!redis) return;

  const keys = new Set<string>([`subtopic:${subtopicId}:arguments`, `argument:${argumentId}`]);

  if (parentId != null) {
    let cursor: string | null = parentId;
    let guard = 0;
    while (cursor != null && guard < 200) {
      keys.add(`argument:${cursor}`);
      const row: { parentId: string | null } | null = await prisma.argument.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = row?.parentId ?? null;
      guard += 1;
    }
  }

  await Promise.all([...keys].map((key) => redis.del(key).catch(() => 0)));
}

function emitArgumentCreated(payload: ArgumentCreatedPayload) {
  emitToRoom(getSubtopicRoom(payload.subtopicId), "ARGUMENT_CREATED", payload);
}

/**
 * Retrieves one argument and computes its `childrenByStatus` projection.
 *
 * Side effects: triggers a fire-and-forget view-count increment and may read/write Redis.
 *
 * @param id Argument identifier.
 * @returns Enriched argument, or `null` when not found.
 */
export async function getEnrichedArgument(id: string) {
  const redis = getRedisClient();
  const cacheKey = `argument:${id}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // cache read failure — fall through to DB
    }
  }

  const argument = await getArgumentById(id);
  if (!argument) return null;

  incrementViewCount(id).catch(() => {});

  const childStatuses = await getChildStatuses(argument.childIds);
  const statusMap = new Map(childStatuses.map((c) => [c.id, c.status]));
  const childrenByStatus = groupByStatus(argument.childIds, statusMap);

  const enriched = { ...argument, childrenByStatus };

  if (redis) {
    redis.set(cacheKey, JSON.stringify(enriched), "EX", ARGUMENT_TTL).catch(() => {});
  }

  return enriched;
}

/**
 * Retrieves argument context needed by breadcrumb/detail pages.
 *
 * @param id Argument identifier.
 * @returns Context object with argument, subtopic, and topic, or `null` when missing.
 */
export async function getArgumentContext(id: string) {
  const row = await getArgumentWithSubtopicAndTopic(id);
  if (!row) return null;

  const childStatuses = await getChildStatuses(row.childIds);
  const statusMap = new Map(childStatuses.map((c) => [c.id, c.status]));
  const childrenByStatus = groupByStatus(row.childIds, statusMap);

  const { subtopic: subtopicWithTopic, ...argumentFields } = row;
  const { topic, ...subtopicFields } = subtopicWithTopic;

  return {
    argument: { ...argumentFields, childrenByStatus },
    subtopic: subtopicFields,
    topic,
  };
}

/**
 * Builds a root-first ancestor chain for an argument.
 *
 * @param id Target argument identifier.
 * @returns Ordered ancestors, or `null` when the first lookup fails.
 */
export async function getAncestorChain(id: string): Promise<AncestorNode[] | null> {
  const chain: AncestorNode[] = [];
  let currentId: string | null = id;
  let iterations = 0;

  while (currentId !== null && iterations < 100) {
    const arg = await getAncestorNode(currentId);
    if (!arg) {
      if (chain.length === 0) return null;
      break;
    }

    chain.push({
      id: arg.id,
      schemeId: arg.schemeId,
      argumentText: arg.argumentText,
      isInitial: arg.isInitial,
      status: arg.status,
      parentId: arg.parentId,
    });

    if (arg.isInitial) break;
    currentId = arg.parentId;
    iterations++;
  }

  chain.reverse();
  return chain;
}

const STATUS_ORDER: Record<string, number> = { IN: 0, UNDECIDED: 1, OUT: 2 };

/**
 * Returns cursor-paginated children for an argument with optional sort mode.
 *
 * @param id Parent argument identifier.
 * @param sort Sort mode for children.
 * @param limit Maximum number of children in this page.
 * @param after Optional cursor id for pagination.
 * @returns Paginated children and next cursor, or `null` when parent is missing.
 */
export async function getArgumentChildren(
  id: string,
  sort: ChildrenSort,
  limit: number,
  after?: string,
) {
  const exists = await argumentExists(id);
  if (!exists) return null;

  let page: Awaited<ReturnType<typeof getChildrenByParent>>;
  let nextCursor: string | null = null;

  if (sort === "status") {
    const all = await getAllChildrenByParent(id);
    all.sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );

    let startIdx = 0;
    if (after) {
      const idx = all.findIndex((a) => a.id === after);
      startIdx = idx >= 0 ? idx + 1 : all.length;
    }
    page = all.slice(startIdx, startIdx + limit);
    nextCursor = startIdx + limit < all.length && page.length > 0 ? page[page.length - 1].id : null;
  } else {
    const orderBy = sortToOrderBy(sort);
    const rows = await getChildrenByParent(id, {
      orderBy,
      take: limit + 1,
      cursor: after,
    });

    if (rows.length > limit) {
      rows.pop();
      nextCursor = rows[rows.length - 1].id;
    }
    page = rows;
  }

  const children = await enrichChildren(page);
  return { children, nextCursor };
}

function sortToOrderBy(sort: ChildrenSort): Record<string, string> | Record<string, string>[] {
  switch (sort) {
    case "newest":
      return { createdAt: "desc" };
    case "oldest":
      return { createdAt: "asc" };
    case "most_descendants":
      return [{ descendantCount: "desc" }, { createdAt: "desc" }];
    case "most_viewed":
      return [{ viewCount: "desc" }, { createdAt: "desc" }];
    default:
      return { createdAt: "desc" };
  }
}

async function enrichChildren(children: Awaited<ReturnType<typeof getAllChildrenByParent>>) {
  const allGrandchildIds = children.flatMap((c) => c.childIds);
  const grandchildStatuses = await getChildStatuses(allGrandchildIds);
  const statusMap = new Map(grandchildStatuses.map((g) => [g.id, g.status]));

  return children.map((child) => ({
    ...child,
    childrenByStatus: groupByStatus(child.childIds, statusMap),
  }));
}

const HOME_ARGUMENT_LIST_LIMIT = 10;

const homeListSubtopicInclude = {
  subtopic: {
    select: {
      id: true,
      title: true,
      topicId: true,
      topic: { select: { id: true, title: true } },
    },
  },
} as const;

async function getPlatformStats() {
  const [registeredUsers, byStatus] = await Promise.all([
    prisma.user.count(),
    prisma.argument.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of byStatus) {
    counts[row.status] = row._count._all;
  }

  const argumentsIn = counts.IN ?? 0;
  const argumentsOut = counts.OUT ?? 0;
  const argumentsUndecided = counts.UNDECIDED ?? 0;

  return {
    registeredUsers,
    totalArguments: argumentsIn + argumentsOut + argumentsUndecided,
    argumentsIn,
    argumentsOut,
    argumentsUndecided,
  };
}

/**
 * Loads ranked lists for the public home page: top initial roots by descendant count
 * and most recently created arguments of any kind, plus aggregate platform statistics.
 */
export async function getHomeArgumentLists() {
  const [platformStats, topInitial, recent] = await Promise.all([
    getPlatformStats(),
    prisma.argument.findMany({
      where: { isInitial: true },
      orderBy: [{ descendantCount: "desc" }, { createdAt: "desc" }],
      take: HOME_ARGUMENT_LIST_LIMIT,
      include: homeListSubtopicInclude,
    }),
    prisma.argument.findMany({
      orderBy: { createdAt: "desc" },
      take: HOME_ARGUMENT_LIST_LIMIT,
      include: homeListSubtopicInclude,
    }),
  ]);

  const mapRow = (arg: (typeof topInitial)[number]) => ({
    id: arg.id,
    argumentText: arg.argumentText,
    descendantCount: arg.descendantCount,
    createdAt: arg.createdAt.toISOString(),
    isInitial: arg.isInitial,
    subtopicId: arg.subtopicId,
    topicId: arg.subtopic.topic.id,
    topicTitle: arg.subtopic.topic.title,
    subtopicTitle: arg.subtopic.title,
  });

  return {
    platformStats,
    topInitialByDescendants: topInitial.map(mapRow),
    recent: recent.map(mapRow),
  };
}
