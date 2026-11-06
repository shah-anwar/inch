import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import { buildPrismaMock, resetPrismaMock, type MockPrisma } from "../../setup/mocks/prisma.js";
import { buildRedisMock, type MockRedis } from "../../setup/mocks/redis.js";
import type { ChildrenSort } from "@inch/types";
import { CriticalQuestionSchema } from "@inch/types";

const prismaMock = buildPrismaMock();

const createInitialArgument = jest.fn();
const createCounterArgument = jest.fn();
const getArgumentById = jest.fn();
const getArgumentsBySubtopic = jest.fn();
const getChildStatuses = jest.fn();
const getArgumentWithSubtopicAndTopic = jest.fn();
const getAncestorNode = jest.fn();
const getChildrenByParent = jest.fn();
const getAllChildrenByParent = jest.fn();
const argumentExists = jest.fn();
const incrementViewCount = jest.fn();

jest.unstable_mockModule("@db/prisma.js", () => ({
  prisma: prismaMock,
}));

jest.unstable_mockModule("../../../src/modules/argumentation/argument.repository.js", () => ({
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
}));

const getRedisClient = jest.fn<() => MockRedis | null>();

jest.unstable_mockModule("../../../src/cache/redis.js", () => ({
  getRedisClient,
}));

const evaluationQueueAdd = jest.fn();

jest.unstable_mockModule("../../../src/queue/evaluationQueue.js", () => ({
  evaluationQueue: { add: evaluationQueueAdd },
}));

const generateArgumentTextVariations = jest.fn();
const moderateArgumentSubmission = jest.fn();
const moderateVariableInputs = jest.fn();
const validateAndConsumeTextPreview = jest.fn();
const releaseTextPreview = jest.fn();

jest.unstable_mockModule("../../../src/modules/argumentation/llm/argument-text.js", () => ({
  generateArgumentTextVariations,
}));

jest.unstable_mockModule("../../../src/modules/argumentation/llm/moderation.js", () => ({
  moderateArgumentSubmission,
  moderateVariableInputs,
  ModerationFailedError: class ModerationFailedError extends Error {
    violations: Array<{ variableId: string; reason: string }>;
    constructor(violations: Array<{ variableId: string; reason: string }>) {
      super("moderation_failed");
      this.name = "ModerationFailedError";
      this.violations = violations;
    }
  },
}));

jest.unstable_mockModule("../../../src/modules/argumentation/llm/text-preview-store.js", () => ({
  validateAndConsumeTextPreview,
  releaseTextPreview,
}));

type ArgumentService = typeof import("../../../src/modules/argumentation/argument.service.js");

let svc: ArgumentService;

function baseInitialPayload() {
  return {
    schemeId: "expert_opinion",
    subtopicId: 9,
    textPreviewToken: "preview-token",
    selectedOptionId: "opt-1",
    variables: [
      { variableId: "expert", value: "Dr. X" },
      { variableId: "domain", value: "climate" },
      { variableId: "claim", value: "Earth warms" },
    ],
  };
}

function baseCounterPayload() {
  return {
    schemeId: "position_to_know",
    selectedCqId: "cq_eo_1",
    parentArgumentId: "parent-1",
    textPreviewToken: "preview-token-2",
    selectedOptionId: "opt-2",
    variables: [
      { variableId: "source", value: "Analyst" },
      { variableId: "domain", value: "finance" },
      { variableId: "claim", value: "Solvent" },
    ],
  };
}

const EXPERT_VARIABLES_JSON = [
  {
    id: "expert",
    name: "Expert (E)",
    description: "e",
    placeholder: "p",
    required: true,
    type: "entity" as const,
  },
  {
    id: "domain",
    name: "Subject Domain (S)",
    description: "d",
    placeholder: "p",
    required: true,
    type: "string" as const,
  },
  {
    id: "claim",
    name: "Claim (A)",
    description: "c",
    placeholder: "p",
    required: true,
    type: "claim" as const,
  },
];

const PTK_VARIABLES_JSON = [
  {
    id: "source",
    name: "Source (a)",
    description: "s",
    placeholder: "p",
    required: true,
    type: "entity" as const,
  },
  {
    id: "domain",
    name: "Subject Domain (S)",
    description: "d",
    placeholder: "p",
    required: true,
    type: "string" as const,
  },
  {
    id: "claim",
    name: "Claim (A)",
    description: "c",
    placeholder: "p",
    required: true,
    type: "claim" as const,
  },
];

const ANALOGY_VARIABLES_JSON = [
  {
    id: "case_c1",
    name: "C1",
    description: "c",
    placeholder: "p",
    required: true,
    type: "string" as const,
  },
  {
    id: "case_c2",
    name: "C2",
    description: "c",
    placeholder: "p",
    required: true,
    type: "string" as const,
  },
  {
    id: "claim",
    name: "Claim",
    description: "c",
    placeholder: "p",
    required: true,
    type: "claim" as const,
  },
  {
    id: "similarity",
    name: "Similarity",
    description: "s",
    placeholder: "p",
    required: true,
    type: "string" as const,
  },
];

function wireDefaultSchemeMocks() {
  const expertRow = {
    id: "expert_opinion",
    name: "Argument from Expert Opinion",
    description: "desc",
    conclusion: "A is true (false).",
    variables: EXPERT_VARIABLES_JSON,
    criticalQuestions: [
      CriticalQuestionSchema.parse({
        id: "cq_eo_1",
        text: "Expertise Question",
        description: "d",
        validResponseSchemeIds: ["position_to_know", "sign"],
      }),
      CriticalQuestionSchema.parse({
        id: "cq_eo_2",
        text: "Field Question",
        description: "d",
        validResponseSchemeIds: ["position_to_know", "analogy"],
      }),
    ],
  };
  const ptkRow = {
    id: "position_to_know",
    name: "Argument from Position to Know",
    description: "desc",
    conclusion: "A is true (false).",
    variables: PTK_VARIABLES_JSON,
    criticalQuestions: [] as never[],
  };
  const analogyRow = {
    id: "analogy",
    name: "Argument from Analogy",
    description: "desc",
    conclusion: "A is true (false) in case C2.",
    variables: ANALOGY_VARIABLES_JSON,
    criticalQuestions: [] as never[],
  };

  prismaMock.scheme.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
    switch (args.where.id) {
      case "expert_opinion":
        return expertRow;
      case "position_to_know":
        return ptkRow;
      case "analogy":
        return analogyRow;
      default:
        return null;
    }
  });
}

beforeAll(async () => {
  svc = await import("../../../src/modules/argumentation/argument.service.js");
});

describe("argument.service", () => {
  let redis: MockRedis;

  beforeEach(() => {
    resetPrismaMock(prismaMock);
    redis = buildRedisMock();
    getRedisClient.mockReturnValue(null);

    createInitialArgument.mockReset();
    createCounterArgument.mockReset();
    getArgumentById.mockReset();
    getArgumentsBySubtopic.mockReset();
    getChildStatuses.mockReset();
    getArgumentWithSubtopicAndTopic.mockReset();
    getAncestorNode.mockReset();
    getChildrenByParent.mockReset();
    getAllChildrenByParent.mockReset();
    argumentExists.mockReset();
    incrementViewCount.mockReset();
    evaluationQueueAdd.mockReset();
    generateArgumentTextVariations.mockReset();
    moderateArgumentSubmission.mockReset();
    moderateVariableInputs.mockReset();
    validateAndConsumeTextPreview.mockReset();
    releaseTextPreview.mockReset();

    prismaMock.activeScheme.findMany.mockResolvedValue([
      { schemeId: "expert_opinion" },
      { schemeId: "position_to_know" },
      { schemeId: "analogy" },
    ]);

    wireDefaultSchemeMocks();

    moderateArgumentSubmission.mockResolvedValue({ allowed: true });
    moderateVariableInputs.mockResolvedValue({ passed: true });
    validateAndConsumeTextPreview.mockResolvedValue("Canonical argument text");
    incrementViewCount.mockResolvedValue(undefined);
    evaluationQueueAdd.mockResolvedValue({ id: "job" });
    getChildStatuses.mockResolvedValue([]);
  });

  describe("submitInitialArgument", () => {
    it("rejects an unknown scheme id", async () => {
      await expect(
        svc.submitInitialArgument({ ...baseInitialPayload(), schemeId: "not_a_scheme" }, 1),
      ).rejects.toThrow("Unknown scheme: not_a_scheme");
      expect(validateAndConsumeTextPreview).not.toHaveBeenCalled();
    });

    it("rejects when a required variable is empty", async () => {
      await expect(
        svc.submitInitialArgument(
          {
            ...baseInitialPayload(),
            variables: [
              { variableId: "expert", value: "   " },
              { variableId: "domain", value: "d" },
              { variableId: "claim", value: "c" },
            ],
          },
          1,
        ),
      ).rejects.toThrow('Required variable "expert" is missing or empty');
    });

    it("propagates preview validation failures", async () => {
      validateAndConsumeTextPreview.mockRejectedValueOnce(new Error("bad preview"));

      await expect(svc.submitInitialArgument(baseInitialPayload(), 1)).rejects.toThrow(
        "bad preview",
      );
      expect(moderateArgumentSubmission).not.toHaveBeenCalled();
    });

    it("rejects moderated text when not allowed without a reason", async () => {
      moderateArgumentSubmission.mockResolvedValueOnce({ allowed: false });

      await expect(svc.submitInitialArgument(baseInitialPayload(), 1)).rejects.toThrow(
        "Argument text failed moderation",
      );
    });

    it("rejects moderated text when not allowed with a reason", async () => {
      moderateArgumentSubmission.mockResolvedValueOnce({
        allowed: false,
        reason: "policy",
      });

      await expect(svc.submitInitialArgument(baseInitialPayload(), 1)).rejects.toThrow("policy");
    });

    it("rejects when the subtopic does not exist", async () => {
      prismaMock.subtopic.findUnique.mockResolvedValue(null);

      await expect(svc.submitInitialArgument(baseInitialPayload(), 1)).rejects.toThrow(
        "Subtopic 9 not found",
      );
      expect(createInitialArgument).not.toHaveBeenCalled();
    });

    it("persists, enqueues evaluation, and returns the created argument", async () => {
      prismaMock.subtopic.findUnique.mockResolvedValue({ id: 9 });
      const created = {
        id: "new-arg",
        subtopicId: 9,
        schemeId: "expert_opinion",
      };
      createInitialArgument.mockResolvedValue(created);

      const result = await svc.submitInitialArgument(baseInitialPayload(), 7);

      expect(prismaMock.subtopic.findUnique).toHaveBeenCalledWith({
        where: { id: 9 },
      });
      expect(createInitialArgument).toHaveBeenCalledWith(
        { ...baseInitialPayload(), argumentText: "Canonical argument text" },
        7,
      );
      expect(evaluationQueueAdd).toHaveBeenCalledWith(
        "eval:new-arg",
        { subtopicId: 9, newArgumentId: "new-arg" },
        { jobId: "subtopic:9:new-arg" },
      );
      expect(result).toBe(created);
    });
  });

  describe("submitCounterArgument", () => {
    it("rejects unknown scheme", async () => {
      await expect(
        svc.submitCounterArgument({ ...baseCounterPayload(), schemeId: "unknown" }, 1),
      ).rejects.toThrow("Unknown scheme: unknown");
    });

    it("rejects when parent argument is missing", async () => {
      getArgumentById.mockResolvedValue(null);

      await expect(svc.submitCounterArgument(baseCounterPayload(), 1)).rejects.toThrow(
        "Parent argument not found",
      );
    });

    it("rejects when CQ does not belong to parent scheme", async () => {
      getArgumentById.mockResolvedValue({
        schemeId: "expert_opinion",
        id: "parent-1",
      });

      await expect(
        svc.submitCounterArgument({ ...baseCounterPayload(), selectedCqId: "cq_ptk_1" }, 1),
      ).rejects.toThrow("CQ cq_ptk_1 does not belong to scheme expert_opinion");
    });

    it("rejects when response scheme is not valid for the CQ", async () => {
      getArgumentById.mockResolvedValue({
        schemeId: "expert_opinion",
        id: "parent-1",
      });

      await expect(
        svc.submitCounterArgument(
          {
            ...baseCounterPayload(),
            schemeId: "analogy",
            variables: [
              { variableId: "case_c1", value: "C1" },
              { variableId: "case_c2", value: "C2" },
              { variableId: "claim", value: "claim" },
              { variableId: "similarity", value: "sim" },
            ],
          },
          1,
        ),
      ).rejects.toThrow("Scheme analogy is not a valid response to CQ cq_eo_1");
    });

    it("creates counter argument and enqueues evaluation", async () => {
      getArgumentById.mockResolvedValue({
        schemeId: "expert_opinion",
        id: "parent-1",
        subtopicId: 3,
      });
      const created = {
        id: "counter-1",
        subtopicId: 3,
      };
      createCounterArgument.mockResolvedValue(created);

      const result = await svc.submitCounterArgument(baseCounterPayload(), 2);

      expect(createCounterArgument).toHaveBeenCalledWith(
        { ...baseCounterPayload(), argumentText: "Canonical argument text" },
        2,
      );
      expect(evaluationQueueAdd).toHaveBeenCalledWith(
        "eval:counter-1",
        { subtopicId: 3, newArgumentId: "counter-1" },
        { jobId: "subtopic:3:counter-1" },
      );
      expect(result).toBe(created);
    });
  });

  describe("previewArgumentText", () => {
    it("throws for unknown scheme", async () => {
      await expect(
        svc.previewArgumentText(
          {
            kind: "initial",
            schemeId: "nope",
            subtopicId: 1,
            variables: [],
          } as import("@inch/types").GenerateArgumentTextRequest,
          1,
        ),
      ).rejects.toThrow("Unknown scheme: nope");
    });

    it("throws when required variables are missing", async () => {
      await expect(
        svc.previewArgumentText(
          {
            kind: "initial",
            schemeId: "expert_opinion",
            subtopicId: 1,
            variables: [{ variableId: "expert", value: "E" }],
          } as import("@inch/types").GenerateArgumentTextRequest,
          1,
        ),
      ).rejects.toThrow('Required variable "domain" is missing or empty');
    });

    it("delegates to generateArgumentTextVariations after moderation passes", async () => {
      const req = {
        kind: "initial" as const,
        schemeId: "expert_opinion",
        subtopicId: 1,
        variables: [
          { variableId: "expert", value: "E" },
          { variableId: "domain", value: "D" },
          { variableId: "claim", value: "C" },
        ],
      };
      const out = {
        previewToken: "t",
        options: [
          { id: "a", text: "x" },
          { id: "b", text: "y" },
          { id: "c", text: "z" },
        ],
        fallback: "",
      };
      generateArgumentTextVariations.mockResolvedValue(out);

      await expect(svc.previewArgumentText(req, 5)).resolves.toBe(out);
      expect(moderateVariableInputs).toHaveBeenCalled();
      expect(generateArgumentTextVariations).toHaveBeenCalledWith(req, "5");
    });

    it("throws when variable moderation fails", async () => {
      moderateVariableInputs.mockResolvedValueOnce({
        passed: false,
        violations: [{ variableId: "claim", reason: "Not acceptable" }],
      });
      const req = {
        kind: "initial" as const,
        schemeId: "expert_opinion",
        subtopicId: 1,
        variables: [
          { variableId: "expert", value: "E" },
          { variableId: "domain", value: "D" },
          { variableId: "claim", value: "C" },
        ],
      };
      await expect(svc.previewArgumentText(req, 5)).rejects.toThrow("moderation_failed");
      expect(generateArgumentTextVariations).not.toHaveBeenCalled();
    });
  });

  // A CQ with an empty validResponseSchemeIds list can be answered with any
  // active scheme (same rule as getValidResponseSchemes in @inch/types).
  describe("empty validResponseSchemeIds (any active scheme may respond)", () => {
    const openCq = CriticalQuestionSchema.parse({
      id: "cq_eo_3",
      text: "Opinion Question",
      description: "d",
      validResponseSchemeIds: [],
    });
    const restrictedCq = CriticalQuestionSchema.parse({
      id: "cq_eo_1",
      text: "Expertise Question",
      description: "d",
      validResponseSchemeIds: ["position_to_know", "sign"],
    });
    const analogyCounter = {
      ...baseCounterPayload(),
      schemeId: "analogy",
      selectedCqId: "cq_eo_3",
      variables: [
        { variableId: "case_c1", value: "C1" },
        { variableId: "case_c2", value: "C2" },
        { variableId: "claim", value: "claim" },
        { variableId: "similarity", value: "sim" },
      ],
    };

    function row(id: string, variables: unknown[], cqs: unknown[]) {
      return {
        id,
        name: id,
        description: "desc",
        conclusion: "A is true (false).",
        variables,
        criticalQuestions: cqs,
      };
    }

    beforeEach(() => {
      const rows: Record<string, ReturnType<typeof row>> = {
        expert_opinion: row("expert_opinion", EXPERT_VARIABLES_JSON, [restrictedCq, openCq]),
        position_to_know: row("position_to_know", PTK_VARIABLES_JSON, [openCq]),
        analogy: row("analogy", ANALOGY_VARIABLES_JSON, [openCq]),
      };
      prismaMock.scheme.findUnique.mockImplementation(
        async (args: { where: { id: string } }) => rows[args.where.id] ?? null,
      );
      prismaMock.scheme.findMany.mockResolvedValue(Object.values(rows));
      getArgumentById.mockResolvedValue({
        schemeId: "expert_opinion",
        id: "parent-1",
        subtopicId: 3,
      });
    });

    it("lists the empty-list CQ as visible", async () => {
      const cqs = await svc.listVisibleCriticalQuestionsForArgument("parent-1");
      expect(cqs?.map((cq) => cq.id)).toEqual(["cq_eo_1", "cq_eo_3"]);
    });

    it("hides the empty-list CQ when no scheme is active", async () => {
      prismaMock.activeScheme.findMany.mockResolvedValue([]);
      const cqs = await svc.listVisibleCriticalQuestionsForArgument("parent-1");
      expect(cqs).toEqual([]);
    });

    it("offers every visible active scheme as a response to the empty-list CQ", async () => {
      const schemes = await svc.listVisibleResponseSchemesForArgumentCq("parent-1", "cq_eo_3");
      expect(schemes?.map((s) => s.id)).toEqual(["expert_opinion", "position_to_know", "analogy"]);
    });

    it("still restricts responses for a non-empty list", async () => {
      // sign is listed but not active, analogy is active but not listed.
      const schemes = await svc.listVisibleResponseSchemesForArgumentCq("parent-1", "cq_eo_1");
      expect(schemes?.map((s) => s.id)).toEqual(["position_to_know"]);
    });

    it("accepts a counter-argument from any active scheme for the empty-list CQ", async () => {
      createCounterArgument.mockResolvedValue({ id: "counter-9", subtopicId: 3 });
      await expect(svc.submitCounterArgument(analogyCounter, 2)).resolves.toEqual({
        id: "counter-9",
        subtopicId: 3,
      });
      expect(createCounterArgument).toHaveBeenCalled();
    });

    it("still rejects an unlisted scheme for a non-empty list", async () => {
      await expect(
        svc.submitCounterArgument({ ...analogyCounter, selectedCqId: "cq_eo_1" }, 2),
      ).rejects.toThrow("Scheme analogy is not a valid response to CQ cq_eo_1");
      expect(createCounterArgument).not.toHaveBeenCalled();
    });

    it("still rejects an inactive scheme for the empty-list CQ", async () => {
      prismaMock.activeScheme.findMany.mockResolvedValue([{ schemeId: "expert_opinion" }]);
      await expect(svc.submitCounterArgument(analogyCounter, 2)).rejects.toThrow(
        "Scheme analogy is not currently active",
      );
    });

    it("generates text options for an empty-list CQ counter", async () => {
      generateArgumentTextVariations.mockResolvedValue({
        previewToken: "t",
        options: [],
        fallback: "",
      });
      const req = {
        kind: "counter" as const,
        schemeId: "analogy",
        parentArgumentId: "parent-1",
        selectedCqId: "cq_eo_3",
        variables: analogyCounter.variables,
      };
      await expect(svc.previewArgumentText(req, 5)).resolves.toMatchObject({ previewToken: "t" });
      expect(generateArgumentTextVariations).toHaveBeenCalledWith(req, "5");
    });
  });

  describe("discardArgumentTextPreview", () => {
    it("releases the preview token", async () => {
      releaseTextPreview.mockResolvedValue(undefined);
      await svc.discardArgumentTextPreview("tok-99", 42);
      expect(releaseTextPreview).toHaveBeenCalledWith("tok-99", "42");
    });
  });

  describe("getSubtopicGraph", () => {
    it("returns [] when there is no redis and no arguments", async () => {
      getArgumentsBySubtopic.mockResolvedValue([]);
      await expect(svc.getSubtopicGraph(1)).resolves.toEqual([]);
    });

    it("returns cached JSON when redis hit succeeds", async () => {
      getRedisClient.mockReturnValue(redis);
      const payload = [{ id: "cached" }];
      redis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(svc.getSubtopicGraph(2)).resolves.toEqual(payload);
      expect(getArgumentsBySubtopic).not.toHaveBeenCalled();
    });

    it("falls back to DB when redis get throws", async () => {
      getRedisClient.mockReturnValue(redis);
      redis.get.mockRejectedValueOnce(new Error("redis down"));
      getArgumentsBySubtopic.mockResolvedValue([]);

      await expect(svc.getSubtopicGraph(3)).resolves.toEqual([]);
    });

    it("builds childrenByStatus, caches, and ignores set failures", async () => {
      getRedisClient.mockReturnValue(redis);
      redis.get.mockResolvedValueOnce(null);
      redis.set.mockRejectedValueOnce(new Error("no write"));

      const args = [
        {
          id: "a1",
          childIds: ["c1", "c2", "c3", "c4"],
          other: 1,
        },
      ];
      getArgumentsBySubtopic.mockResolvedValue(args as never);
      getChildStatuses.mockResolvedValue([
        { id: "c1", status: "IN" },
        { id: "c2", status: "OUT" },
        { id: "c3", status: "UNDECIDED" },
        { id: "c4", status: "WEIRD" },
      ]);

      const result = await svc.getSubtopicGraph(4);

      expect(getChildStatuses).toHaveBeenCalled();
      expect(result[0]).toMatchObject({
        id: "a1",
        childrenByStatus: {
          in: ["c1"],
          out: ["c2"],
          undecided: ["c3", "c4"],
        },
      });
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("getEnrichedArgument", () => {
    it("returns cached value from redis when present", async () => {
      getRedisClient.mockReturnValue(redis);
      const cached = { id: "x", childrenByStatus: {} };
      redis.get.mockResolvedValueOnce(JSON.stringify(cached));

      await expect(svc.getEnrichedArgument("x")).resolves.toEqual(cached);
      expect(getArgumentById).not.toHaveBeenCalled();
    });

    it("falls back when redis read throws", async () => {
      getRedisClient.mockReturnValue(redis);
      redis.get.mockRejectedValueOnce(new Error("read fail"));
      getArgumentById.mockResolvedValue(null);

      await expect(svc.getEnrichedArgument("missing")).resolves.toBeNull();
    });

    it("returns null when the argument does not exist", async () => {
      getArgumentById.mockResolvedValue(null);
      await expect(svc.getEnrichedArgument("nope")).resolves.toBeNull();
      expect(incrementViewCount).not.toHaveBeenCalled();
    });

    it("enriches children, increments views best-effort, and caches", async () => {
      getRedisClient.mockReturnValue(redis);
      redis.get.mockResolvedValueOnce(null);
      incrementViewCount.mockRejectedValueOnce(new Error("view fail"));

      const arg = {
        id: "arg1",
        childIds: ["x", "y"],
        schemeId: "expert_opinion",
      };
      getArgumentById.mockResolvedValue(arg as never);
      getChildStatuses.mockResolvedValue([
        { id: "x", status: "IN" },
        { id: "y", status: "OUT" },
      ]);

      const enriched = await svc.getEnrichedArgument("arg1");

      expect(incrementViewCount).toHaveBeenCalledWith("arg1");
      expect(enriched).toMatchObject({
        id: "arg1",
        childrenByStatus: { in: ["x"], out: ["y"], undecided: [] },
      });
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("getArgumentContext", () => {
    it("returns null when the row is missing", async () => {
      getArgumentWithSubtopicAndTopic.mockResolvedValue(null);
      await expect(svc.getArgumentContext("z")).resolves.toBeNull();
    });

    it("returns nested argument, subtopic, and topic with childrenByStatus", async () => {
      const row = {
        id: "a",
        childIds: ["c1"],
        schemeId: "expert_opinion",
        subtopic: {
          id: 1,
          title: "S",
          topic: { id: 10, title: "T" },
          extra: "x",
        },
      };
      getArgumentWithSubtopicAndTopic.mockResolvedValue(row as never);
      getChildStatuses.mockResolvedValue([{ id: "c1", status: "UNDECIDED" }]);

      const ctx = await svc.getArgumentContext("a");

      expect(ctx).toEqual({
        argument: {
          id: "a",
          childIds: ["c1"],
          schemeId: "expert_opinion",
          childrenByStatus: { in: [], out: [], undecided: ["c1"] },
        },
        subtopic: { id: 1, title: "S", extra: "x" },
        topic: { id: 10, title: "T" },
      });
    });
  });

  describe("getAncestorChain", () => {
    it("returns null when the first node is missing", async () => {
      getAncestorNode.mockResolvedValue(null);
      await expect(svc.getAncestorChain("root")).resolves.toBeNull();
    });

    it("stops with a partial chain when a later ancestor is missing", async () => {
      getAncestorNode
        .mockResolvedValueOnce({
          id: "c",
          schemeId: "s",
          argumentText: "t",
          isInitial: false,
          status: "UNDECIDED",
          parentId: "p",
        })
        .mockResolvedValueOnce(null);

      const chain = await svc.getAncestorChain("c");
      expect(chain).toEqual([
        {
          id: "c",
          schemeId: "s",
          argumentText: "t",
          isInitial: false,
          status: "UNDECIDED",
          parentId: "p",
        },
      ]);
    });

    it("returns a reversed chain ending at the initial argument", async () => {
      getAncestorNode
        .mockResolvedValueOnce({
          id: "leaf",
          schemeId: "s2",
          argumentText: "L",
          isInitial: false,
          status: "IN",
          parentId: "root",
        })
        .mockResolvedValueOnce({
          id: "root",
          schemeId: "s1",
          argumentText: "R",
          isInitial: true,
          status: "UNDECIDED",
          parentId: null,
        });

      const chain = await svc.getAncestorChain("leaf");
      expect(chain?.map((n) => n.id)).toEqual(["root", "leaf"]);
    });

    it("exits the walk after many non-initial hops", async () => {
      const node = {
        id: "loop",
        schemeId: "s",
        argumentText: "t",
        isInitial: false,
        status: "UNDECIDED" as const,
        parentId: "loop",
      };
      getAncestorNode.mockImplementation(async (id: string) =>
        id === "start" ? { ...node, id: "start", parentId: "loop" } : { ...node },
      );

      const chain = await svc.getAncestorChain("start");
      expect(chain!.length).toBeGreaterThan(1);
      expect(chain![chain!.length - 1].id).toBe("start");
    });
  });

  describe("getArgumentChildren", () => {
    it("returns null when the parent argument does not exist", async () => {
      argumentExists.mockResolvedValue(false);
      await expect(svc.getArgumentChildren("p", "newest", 5)).resolves.toBeNull();
    });

    it("treats unknown child statuses as last tier when sorting by status", async () => {
      argumentExists.mockResolvedValue(true);
      const tOld = new Date("2019-01-01T00:00:00.000Z");
      const tNew = new Date("2020-06-01T00:00:00.000Z");
      getAllChildrenByParent.mockResolvedValue([
        {
          id: "odd-a",
          status: "CUSTOM_A" as never,
          createdAt: tOld,
          childIds: [],
        },
        {
          id: "odd-b",
          status: "CUSTOM_B" as never,
          createdAt: tNew,
          childIds: [],
        },
        {
          id: "in",
          status: "IN",
          createdAt: tNew,
          childIds: [],
        },
      ] as never);

      const page = await svc.getArgumentChildren("p", "status", 10);

      expect(page!.children[0].id).toBe("in");
      expect(page!.children.map((c) => c.id)).toContain("odd-a");
      expect(page!.children.map((c) => c.id)).toContain("odd-b");
    });

    it("sorts by status with cursor and uses createdAt as tie-breaker", async () => {
      argumentExists.mockResolvedValue(true);
      const tOld = new Date("2020-01-01T00:00:00.000Z");
      const tNew = new Date("2021-01-01T00:00:00.000Z");
      getAllChildrenByParent.mockResolvedValue([
        {
          id: "c",
          status: "IN",
          createdAt: tNew,
          childIds: [],
        },
        {
          id: "a",
          status: "UNDECIDED",
          createdAt: tNew,
          childIds: [],
        },
        {
          id: "b",
          status: "UNDECIDED",
          createdAt: tOld,
          childIds: [],
        },
        {
          id: "d",
          status: "OUT",
          createdAt: tNew,
          childIds: [],
        },
      ] as never);

      const page = await svc.getArgumentChildren("p", "status", 2, "c");

      expect(page!.children.map((c) => c.id)).toEqual(["a", "b"]);
      expect(page!.nextCursor).toBe("b");
    });

    it("uses startIdx at end when cursor id is not found", async () => {
      argumentExists.mockResolvedValue(true);
      getAllChildrenByParent.mockResolvedValue([
        { id: "only", status: "IN", createdAt: new Date(), childIds: [] },
      ] as never);

      const page = await svc.getArgumentChildren("p", "status", 5, "missing");

      expect(page!.children).toEqual([]);
      expect(page!.nextCursor).toBeNull();
    });

    it("maps newest, oldest, most_descendants, and most_viewed sorts to prisma order", async () => {
      argumentExists.mockResolvedValue(true);
      getChildrenByParent.mockResolvedValue([]);

      await svc.getArgumentChildren("p", "newest", 3);
      expect(getChildrenByParent).toHaveBeenLastCalledWith("p", {
        orderBy: { createdAt: "desc" },
        take: 4,
        cursor: undefined,
      });

      await svc.getArgumentChildren("p", "oldest", 3);
      expect(getChildrenByParent).toHaveBeenLastCalledWith("p", {
        orderBy: { createdAt: "asc" },
        take: 4,
        cursor: undefined,
      });

      await svc.getArgumentChildren("p", "most_descendants", 2);
      expect(getChildrenByParent).toHaveBeenLastCalledWith("p", {
        orderBy: [{ descendantCount: "desc" }, { createdAt: "desc" }],
        take: 3,
        cursor: undefined,
      });

      await svc.getArgumentChildren("p", "most_viewed", 2);
      expect(getChildrenByParent).toHaveBeenLastCalledWith("p", {
        orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
        take: 3,
        cursor: undefined,
      });
    });

    it("uses default order for an unexpected sort value", async () => {
      argumentExists.mockResolvedValue(true);
      getChildrenByParent.mockResolvedValue([]);

      await svc.getArgumentChildren("p", "bogus" as ChildrenSort, 2);
      expect(getChildrenByParent).toHaveBeenLastCalledWith("p", {
        orderBy: { createdAt: "desc" },
        take: 3,
        cursor: undefined,
      });
    });

    it("returns nextCursor when prisma returns an extra row", async () => {
      argumentExists.mockResolvedValue(true);
      const rows = [
        { id: "r1", childIds: [], createdAt: new Date() },
        { id: "r2", childIds: [], createdAt: new Date() },
      ];
      getChildrenByParent.mockResolvedValue(rows as never);
      getChildStatuses.mockResolvedValue([]);

      const page = await svc.getArgumentChildren("p", "newest", 1);

      expect(page!.children).toHaveLength(1);
      expect(page!.nextCursor).toBe("r1");
    });

    it("enriches grandchildren status buckets", async () => {
      argumentExists.mockResolvedValue(true);
      getChildrenByParent.mockResolvedValue([
        {
          id: "child",
          childIds: ["g1"],
          createdAt: new Date(),
        },
      ] as never);
      getChildStatuses.mockResolvedValue([{ id: "g1", status: "OUT" }]);

      const page = await svc.getArgumentChildren("p", "newest", 5);

      expect(page!.children[0].childrenByStatus).toEqual({
        in: [],
        out: ["g1"],
        undecided: [],
      });
    });
  });
});
