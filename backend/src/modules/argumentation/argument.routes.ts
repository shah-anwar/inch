import {
  CreateInitialArgumentSchema,
  CreateCounterArgumentSchema,
  ChildrenSortSchema,
  RenderArgumentResponseSchema,
  GenerateArgumentTextRequestSchema,
  GenerateArgumentTextResponseSchema,
  ReleaseArgumentTextPreviewRequestSchema,
  SuggestArgumentRequestSchema,
  SuggestArgumentResponseSchema,
  PathDialogueRequestSchema,
  PathDialogueResponseSchema,
  SchemeSchema,
  CriticalQuestionSchema,
  HomeArgumentListsSchema,
  ModerationFailedResponseSchema,
} from "@inch/types";
import { getSchemeById, getCriticalQuestion, renderArgumentText } from "@inch/types";
import type { FastifyInstance } from "fastify";
import { getArgumentById } from "./argument.repository.js";
import {
  submitInitialArgument,
  submitCounterArgument,
  previewArgumentText,
  discardArgumentTextPreview,
  getSubtopicGraph,
  getEnrichedArgument,
  getArgumentContext,
  getAncestorChain,
  getArgumentChildren,
  getHomeArgumentLists,
  listInitialArgumentSchemes,
  listVisibleCriticalQuestionsForArgument,
  listVisibleResponseSchemesForArgumentCq,
} from "./argument.service.js";
import { callMistral } from "./llm/mistral.js";
import { ModerationFailedError } from "./llm/moderation.js";
import { renderArgumentNL } from "./nlrender.js";
import { suggestSchemes } from "./scheme-suggester.js";
import { getAuthenticatedUser } from "../../utils/auth.js";

/**
 * Registers argumentation API endpoints for argument creation, retrieval,
 * graph navigation, text previews, and dialogue rendering.
 *
 * @param fastify Fastify instance used to register route handlers.
 * @returns Resolves after plugin registration.
 */
export async function argumentRoutes(fastify: FastifyInstance) {
  // --- Schemes and critical questions available for new arguments ---

  fastify.get("/schemes", async (_request, reply) => {
    const schemes = await listInitialArgumentSchemes();
    const parsed = SchemeSchema.array().parse(schemes);
    return reply.status(200).send(parsed);
  });

  fastify.get("/arguments/home-lists", async (_request, reply) => {
    const data = await getHomeArgumentLists();
    const parsed = HomeArgumentListsSchema.parse(data);
    return reply.status(200).send(parsed);
  });

  fastify.get("/arguments/:id/critical-questions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const criticalQuestions = await listVisibleCriticalQuestionsForArgument(id);
    if (!criticalQuestions) {
      return reply.status(404).send({ error: "Argument not found" });
    }
    const parsed = CriticalQuestionSchema.array().parse(criticalQuestions);
    return reply.status(200).send(parsed);
  });

  fastify.get(
    "/arguments/:id/critical-questions/:cqId/response-schemes",
    async (request, reply) => {
      const { id, cqId } = request.params as { id: string; cqId: string };
      const schemes = await listVisibleResponseSchemesForArgumentCq(id, cqId);
      if (!schemes) {
        return reply.status(404).send({ error: "Argument or critical question not found" });
      }
      const parsed = SchemeSchema.array().parse(schemes);
      return reply.status(200).send(parsed);
    },
  );

  // --- Argument creation (auth required) ---

  fastify.post("/arguments/initial", async (request, reply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const result = CreateInitialArgumentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    try {
      const argument = await submitInitialArgument(result.data, request.userId!);
      return reply.status(201).send(argument);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bad request";
      return reply.status(400).send({ error: message });
    }
  });

  fastify.post("/arguments/counter", async (request, reply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const result = CreateCounterArgumentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    try {
      const argument = await submitCounterArgument(result.data, request.userId!);
      return reply.status(201).send(argument);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bad request";
      return reply.status(400).send({ error: message });
    }
  });

  // --- Text options: moderation, then LLM generation (auth required) ---

  fastify.post("/arguments/text-options", async (request, reply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const parsed = GenerateArgumentTextRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    try {
      const preview = await previewArgumentText(parsed.data, request.userId!);
      const payload = GenerateArgumentTextResponseSchema.parse(preview);
      return reply.send(payload);
    } catch (err: unknown) {
      if (err instanceof ModerationFailedError) {
        const body = ModerationFailedResponseSchema.parse({
          error: "moderation_failed",
          violations: err.violations,
        });
        return reply.status(422).send(body);
      }
      const message = err instanceof Error ? err.message : "Bad request";
      return reply.status(400).send({ error: message });
    }
  });

  fastify.post("/arguments/text-options/release", async (request, reply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const parsed = ReleaseArgumentTextPreviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    await discardArgumentTextPreview(parsed.data.previewToken, request.userId!);
    return reply.status(204).send();
  });

  // --- Graph and argument reads (public) ---

  fastify.get("/subtopics/:subtopicId/arguments", async (request, reply) => {
    const { subtopicId } = request.params as { subtopicId: string };
    const id = Number(subtopicId);

    if (isNaN(id)) {
      return reply.status(400).send({ error: "Invalid subtopicId" });
    }

    try {
      const args = await getSubtopicGraph(id);
      return reply.send(args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal error";
      return reply.status(500).send({ error: message });
    }
  });

  fastify.get("/arguments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const argument = await getEnrichedArgument(id);
    if (!argument) return reply.status(404).send({ error: "Not found" });
    return reply.send(argument);
  });

  fastify.get("/arguments/:id/render", async (request, reply) => {
    const { id } = request.params as { id: string };

    const argument = await getEnrichedArgument(id);
    if (!argument) {
      return reply.status(404).send({ error: "Not found" });
    }

    const result = renderArgumentNL(id);
    const payload = RenderArgumentResponseSchema.parse(await result);
    return reply.send(payload);
  });

  fastify.get("/arguments/:id/context", async (request, reply) => {
    const { id } = request.params as { id: string };

    const context = await getArgumentContext(id);
    if (!context) return reply.status(404).send({ error: "Not found" });
    return reply.send(context);
  });

  fastify.get("/arguments/:id/ancestors", async (request, reply) => {
    const { id } = request.params as { id: string };

    const ancestors = await getAncestorChain(id);
    if (!ancestors) return reply.status(404).send({ error: "Not found" });
    return reply.send({ ancestors });
  });

  fastify.get("/arguments/:id/children", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;

    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

    const sortResult = ChildrenSortSchema.safeParse(query.sort ?? "newest");
    if (!sortResult.success) {
      return reply
        .status(400)
        .send({ error: "Invalid sort. Valid: newest, oldest, most_descendants, status" });
    }

    const result = await getArgumentChildren(id, sortResult.data, limit, query.after || undefined);

    if (!result) return reply.status(404).send({ error: "Argument not found" });
    return reply.send(result);
  });

  // --- LLM helpers: scheme suggestion and path dialogue ---

  fastify.post("/arguments/suggest", async (request, reply) => {
    const user = await getAuthenticatedUser(request, reply);
    if (!user) return;

    const parsed = SuggestArgumentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const suggestions = await suggestSchemes(parsed.data.text);
    const payload = SuggestArgumentResponseSchema.parse(suggestions);
    return reply.status(200).send(payload);
  });

  fastify.post("/arguments/path-dialogue", async (request, reply) => {
    const parsed = PathDialogueRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const { startArgumentId, endArgumentId } = parsed.data;

    const chain = await getAncestorChain(endArgumentId);
    if (!chain || chain.length === 0) {
      return reply.status(404).send({ error: "End argument not found" });
    }

    const startIndex = chain.findIndex((node) => node.id === startArgumentId);
    if (startIndex === -1) {
      return reply.status(400).send({ error: "Arguments are not on the same ancestor chain" });
    }

    const slice = chain.slice(startIndex);

    const uniqueIds = Array.from(new Set(slice.map((node) => node.id)));
    const argumentsList = await Promise.all(uniqueIds.map((id) => getArgumentById(id)));

    if (argumentsList.some((arg) => arg == null)) {
      return reply.status(404).send({ error: "Argument not found" });
    }

    const byId = new Map(uniqueIds.map((id, index) => [id, argumentsList[index]!]));

    const orderedArguments = slice
      .map((node) => byId.get(node.id))
      .filter((arg): arg is NonNullable<typeof arg> => arg != null);

    const systemPrompt =
      "You write structured debate dialogues. Each turn corresponds to one argument in a chain. Attribute turns to 'Proponent' (isInitial = true or even position in chain) or 'Opponent' (counter-argument / odd position). Output readable prose dialogue only — no JSON, no headers. Do not introduce new arguments and do not evaluate which side is correct.";

    const parts: string[] = [];

    orderedArguments.forEach((argument, index) => {
      const scheme = getSchemeById(argument.schemeId);
      const conclusionTemplate = scheme?.conclusion ?? "";
      const rendered = renderArgumentText(
        conclusionTemplate,
        argument.variables.map((v) => ({
          variableId: v.variableId,
          value: v.value,
        })),
      );
      const dialogueText = argument.argumentText || rendered;

      const role = argument.isInitial || index % 2 === 0 ? "Proponent" : "Opponent";

      let cqText: string | null = null;
      if (argument.selectedCqId && argument.parentId) {
        const parent = byId.get(argument.parentId);
        if (parent) {
          const cq = getCriticalQuestion(parent.schemeId, argument.selectedCqId);
          cqText = cq?.text ?? null;
        }
      }

      parts.push(
        [
          `Turn ${index + 1}:`,
          `Role: ${role}`,
          `Scheme: ${scheme?.name ?? argument.schemeId}`,
          cqText ? `Critical question: ${cqText}` : null,
          `Status: ${argument.status}`,
          `Argument text: ${dialogueText}`,
          index === 0
            ? "This opens the debate."
            : "This argument responds directly to the previous one in the chain.",
        ]
          .filter((line): line is string => line != null)
          .join("\n"),
      );
    });

    const userPrompt = [
      `There are ${orderedArguments.length} arguments in this chain.`,
      "For each turn description below, write one paragraph of dialogue in order, alternating between Proponent and Opponent as specified.",
      "",
      parts.join("\n\n"),
    ].join("\n");

    const dialogueFallback = parts.map((p, index) => `Turn ${index + 1}:\n${p}`).join("\n\n");

    try {
      const content =
        (await callMistral(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          { maxTokens: 800, temperature: 0.4 },
        )) ?? dialogueFallback;

      const payload = PathDialogueResponseSchema.parse({
        dialogue: content.trim(),
        turnCount: orderedArguments.length,
      });

      return reply.send(payload);
    } catch {
      const payload = PathDialogueResponseSchema.parse({
        dialogue: dialogueFallback,
        turnCount: orderedArguments.length,
      });
      return reply.send(payload);
    }
  });
}
