import { getSchemeById, renderArgumentText } from "@inch/types";
import type { ArgumentStatus } from "@inch/types";
import { init } from "@paralleldrive/cuid2";
import { prisma } from "./db/prisma.js";
import {
  evaluateGroundedSemantics,
  type EvaluationGraph,
  type EvaluationNode,
} from "./modules/argumentation/evaluation.js";

const createId = init({ length: 24 });

/** Deepest argument level (root = 0). Default 4 ⇒ 1+8+…+8⁴ = 4,681 nodes. Override for faster runs, e.g. `LOAD_TEST_TREE_MAX_LEVEL=2`. */
const TREE_MAX_LEVEL = Math.min(
  4,
  Math.max(0, Number(process.env.LOAD_TEST_TREE_MAX_LEVEL ?? "4") || 0),
);

const LOAD_TEST_TOPIC_TITLE = "Load Test Topic";
const LINEAR_SUBTOPIC_TITLE = "Linear chain — 100 arguments (single branch, depth 99)";
const treeSubtopicTitle = (): string => {
  const n = full8AryNodeCount(TREE_MAX_LEVEL);
  return `8-ary tree — 8 children/node, levels 0–${TREE_MAX_LEVEL} (${n} nodes)`;
};

function full8AryNodeCount(maxLevel: number): number {
  let sum = 0;
  for (let i = 0; i <= maxLevel; i += 1) sum += 8 ** i;
  return sum;
}

function buildArgumentText(
  schemeId: string,
  variables: Array<{ variableId: string; value: string }>,
): string {
  const scheme = getSchemeById(schemeId);
  if (!scheme) {
    throw new Error(`Unknown scheme: ${schemeId}`);
  }

  return renderArgumentText(scheme.conclusion, variables);
}

async function wipeLoadTestTopic(topicId: number): Promise<void> {
  const subs =
    (await prisma.subtopic.findMany({
      where: { topicId },
      select: { id: true },
    })) ?? [];
  const subtopicIds = subs.map((s) => s.id);
  if (subtopicIds.length > 0) {
    await prisma.argumentVariable.deleteMany({
      where: { argument: { subtopicId: { in: subtopicIds } } },
    });
    await prisma.argument.deleteMany({
      where: { subtopicId: { in: subtopicIds } },
    });
  }
  await prisma.subtopic.deleteMany({ where: { topicId } });
}

function buildLinearCounterVariables(depth: number, isOdd: boolean) {
  if (isOdd) {
    return [
      {
        variableId: "sign",
        value: `the expert's primary research funding comes from institutions relying on efficient argument evaluation (d=${depth})`,
      },
      {
        variableId: "conclusion_b",
        value: "the expert may be biased towards claims that grounded semantics scales well",
      },
      {
        variableId: "sign_relationship",
        value:
          "funding relationships are reliable indicators of potential bias in evaluative claims",
      },
    ];
  }
  return [
    {
      variableId: "expert",
      value: "an independent methods review board specialising in empirical argumentation studies",
    },
    {
      variableId: "domain",
      value: "benchmarking algorithms for structured debate platforms",
    },
    {
      variableId: "claim",
      value: `measured evaluation times remain sub-100ms for chains of length 100 in realistic deployments (d=${depth})`,
    },
  ];
}

async function seedLinearChain(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  subtopicId: number,
  authorId: number,
): Promise<void> {
  const initialId = createId();

  const initialVariables = [
    {
      variableId: "expert",
      value: "Dr. Ada Rivera, Professor of Computational Argumentation",
    },
    {
      variableId: "domain",
      value: "formal models of argumentation and AI safety policy",
    },
    {
      variableId: "claim",
      value:
        "grounded semantics remains tractable for debate graphs with hundreds of nodes in practical policy settings",
    },
  ];

  await tx.argument.create({
    data: {
      id: initialId,
      schemeId: "expert_opinion",
      argumentText: buildArgumentText("expert_opinion", initialVariables),
      isInitial: true,
      parentId: null,
      parentType: "SUBTOPIC",
      subtopicId,
      selectedCqId: null,
      status: "UNDECIDED",
      childIds: [],
      descendantCount: 0,
      authorId,
      variables: { create: initialVariables },
    },
  });

  let parentId: string = initialId;

  for (let index = 1; index < 100; index += 1) {
    const id = createId();
    const isOdd = index % 2 === 1;

    const schemeId = isOdd ? "sign" : "expert_opinion";
    const selectedCqId = isOdd ? "cq_eo_1" : "cq_si_1";

    const variables = buildLinearCounterVariables(index, isOdd);

    await tx.argument.create({
      data: {
        id,
        schemeId,
        argumentText: buildArgumentText(schemeId, variables),
        isInitial: false,
        parentId,
        parentType: "ARGUMENT",
        subtopicId,
        selectedCqId,
        status: "UNDECIDED",
        childIds: [],
        descendantCount: 0,
        authorId,
        variables: { create: variables },
      },
    });

    await tx.argument.update({
      where: { id: parentId },
      data: {
        childIds: [id],
      },
    });

    await tx.argument.update({
      where: { id: initialId },
      data: {
        descendantCount: index,
      },
    });

    parentId = id;
  }
}

async function seed8AryTree(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  subtopicId: number,
  authorId: number,
  maxLevel: number,
): Promise<void> {
  const rootId = createId();
  const childrenMap = new Map<string, string[]>();

  const rootVariables = [
    {
      variableId: "expert",
      value: "Dr. Ada Rivera, Professor of Computational Argumentation",
    },
    {
      variableId: "domain",
      value: "formal models of argumentation and large branching debate graphs",
    },
    {
      variableId: "claim",
      value: "grounded semantics evaluation remains tractable for wide trees used in load testing",
    },
  ];

  await tx.argument.create({
    data: {
      id: rootId,
      schemeId: "expert_opinion",
      argumentText: buildArgumentText("expert_opinion", rootVariables),
      isInitial: true,
      parentId: null,
      parentType: "SUBTOPIC",
      subtopicId,
      selectedCqId: null,
      status: "UNDECIDED",
      childIds: [],
      descendantCount: 0,
      authorId,
      variables: { create: rootVariables },
    },
  });

  let currentLevelIds = [rootId];

  for (let depth = 0; depth < maxLevel; depth += 1) {
    const nextLevelIds: string[] = [];
    for (const parentId of currentLevelIds) {
      const childIds: string[] = [];
      const childDepth = depth + 1;
      const isOdd = childDepth % 2 === 1;
      const schemeId = isOdd ? "sign" : "expert_opinion";
      const selectedCqId = isOdd ? "cq_eo_1" : "cq_si_1";

      for (let i = 0; i < 8; i += 1) {
        const id = createId();
        childIds.push(id);
        const variables = isOdd
          ? [
              {
                variableId: "sign",
                value: `synthetic sign evidence for tree node depth ${childDepth} branch ${i}`,
              },
              {
                variableId: "conclusion_b",
                value: "the parent claim may be biased in high-branching evaluation graphs",
              },
              {
                variableId: "sign_relationship",
                value:
                  "structural position in a wide tree correlates with repeated scheme alternation",
              },
            ]
          : [
              {
                variableId: "expert",
                value: `Synthetic review panel ${childDepth}-${i}`,
              },
              {
                variableId: "domain",
                value: "empirical evaluation of argument graph algorithms",
              },
              {
                variableId: "claim",
                value: `counter position at depth ${childDepth} slot ${i} remains consistent with load-test templates`,
              },
            ];

        await tx.argument.create({
          data: {
            id,
            schemeId,
            argumentText: buildArgumentText(schemeId, variables),
            isInitial: false,
            parentId,
            parentType: "ARGUMENT",
            subtopicId,
            selectedCqId,
            status: "UNDECIDED",
            childIds: [],
            descendantCount: 0,
            authorId,
            variables: { create: variables },
          },
        });
        nextLevelIds.push(id);
      }

      childrenMap.set(parentId, childIds);

      await tx.argument.update({
        where: { id: parentId },
        data: { childIds },
      });
    }
    currentLevelIds = nextLevelIds;
  }

  const memo = new Map<string, number>();
  function descendantCountFor(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const ch = childrenMap.get(id) ?? [];
    let d = 0;
    for (const c of ch) d += 1 + descendantCountFor(c);
    memo.set(id, d);
    return d;
  }

  descendantCountFor(rootId);

  for (const [id, count] of memo) {
    await tx.argument.update({
      where: { id },
      data: { descendantCount: count },
    });
  }
}

async function runEvaluationForSubtopic(subtopicId: number, label: string) {
  const argumentsForEvaluation = await prisma.argument.findMany({
    where: { subtopicId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      parentId: true,
      childIds: true,
    },
  });

  const graph: EvaluationGraph = new Map<string, EvaluationNode>();
  for (const argument of argumentsForEvaluation) {
    graph.set(argument.id, {
      id: argument.id,
      status: argument.status as ArgumentStatus,
      parentId: argument.parentId,
      childIds: argument.childIds,
    });
  }

  const start = performance.now();
  evaluateGroundedSemantics(graph);
  const end = performance.now();

  const finalStatuses = new Map<string, ArgumentStatus>();
  for (const [id, node] of graph.entries()) {
    finalStatuses.set(id, node.status);
  }

  let inCount = 0;
  let outCount = 0;
  let undecidedCount = 0;
  for (const status of finalStatuses.values()) {
    if (status === "IN") inCount += 1;
    else if (status === "OUT") outCount += 1;
    else if (status === "UNDECIDED") undecidedCount += 1;
  }

  let maxDepth = 0;
  for (const node of graph.values()) {
    let depth = 0;
    let currentParentId: string | null = node.parentId;
    while (currentParentId !== null) {
      depth += 1;
      const parentNode = graph.get(currentParentId);
      if (!parentNode) {
        break;
      }
      currentParentId = parentNode.parentId;
    }
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  const durationMs = end - start;

  console.log(`--- ${label} ---`);
  console.log(`Arguments: ${graph.size}`);
  console.log(`Evaluation time: ${durationMs.toFixed(2)}ms`);
  console.log(`IN: ${inCount}  OUT: ${outCount}  UNDECIDED: ${undecidedCount}`);
  console.log(`Longest chain depth: ${maxDepth}`);

  if (durationMs > 100) {
    console.log("Warning: evaluation took over 100ms");
  }
}

async function main() {
  let topic = await prisma.topic.findFirst({
    where: { title: LOAD_TEST_TOPIC_TITLE },
  });
  if (!topic) {
    topic = await prisma.topic.create({
      data: {
        title: LOAD_TEST_TOPIC_TITLE,
        description: "Synthetic topic for evaluation load testing",
      },
    });
  }

  await wipeLoadTestTopic(topic.id);

  const linearSubtopic = await prisma.subtopic.create({
    data: { topicId: topic.id, title: LINEAR_SUBTOPIC_TITLE },
  });
  const treeSubtopic = await prisma.subtopic.create({
    data: { topicId: topic.id, title: treeSubtopicTitle() },
  });

  const seedUser = await prisma.user.upsert({
    where: { email: "seed@inch.dev" },
    create: {
      username: "seed_user",
      email: "seed@inch.dev",
      password: "seed-password-not-for-login",
    },
    update: {},
  });

  console.log(
    `Seeding load test data (linear: 100 args; tree: ${full8AryNodeCount(TREE_MAX_LEVEL)} args, TREE_MAX_LEVEL=${TREE_MAX_LEVEL})`,
  );

  await prisma.$transaction(
    async (tx) => {
      await seedLinearChain(tx, linearSubtopic.id, seedUser.id);
    },
    { timeout: 120_000 },
  );

  await prisma.$transaction(
    async (tx) => {
      await seed8AryTree(tx, treeSubtopic.id, seedUser.id, TREE_MAX_LEVEL);
    },
    { timeout: 480_000 },
  );

  console.log("Load test seeding complete");

  await runEvaluationForSubtopic(linearSubtopic.id, "Linear subtopic");
  await runEvaluationForSubtopic(treeSubtopic.id, "Tree subtopic");

  console.log("Load test complete");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
