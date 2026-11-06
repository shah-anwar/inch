import { prisma } from "@db/prisma.js";
import { renderArgumentText, getSchemeById } from "@inch/types";
import type { SearchResult } from "@inch/types";

/**
 * Runs a cross-entity text search over topics, subtopics, and argument variables.
 * Results are normalized into a single list for the search UI and then paginated in memory.
 *
 * @param query Free-text query string provided by the user.
 * @param page One-based result page index.
 * @param limit Maximum number of results per page.
 * @returns Paginated search results and total match count across all entity types.
 */
export async function search(
  query: string,
  page: number = 1,
  limit: number = 10,
): Promise<{ results: SearchResult[]; total: number }> {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], total: 0 };

  const skip = (page - 1) * limit;

  // Search topics
  const topics = await prisma.topic.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
  });

  // Search subtopics (with parent topic)
  const subtopics = await prisma.subtopic.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    include: { topic: true },
  });

  // Search arguments by variable values (search variable.value)
  const argumentVariables = await prisma.argumentVariable.findMany({
    where: { value: { contains: q, mode: "insensitive" } },
    include: {
      argument: {
        include: {
          variables: true,
          subtopic: { include: { topic: true } },
        },
      },
    },
  });

  // Deduplicate arguments (multiple variables may match)
  const seenArgIds = new Set<string>();
  const matchingArguments = argumentVariables
    .filter((av) => {
      if (seenArgIds.has(av.argument.id)) return false;
      seenArgIds.add(av.argument.id);
      return true;
    })
    .map((av) => av.argument);

  // Build result list
  const allResults: SearchResult[] = [
    ...topics.map((t) => ({
      type: "topic" as const,
      id: t.id,
      title: t.title,
      description: t.description,
    })),
    ...subtopics.map((s) => ({
      type: "subtopic" as const,
      id: s.id,
      topicId: s.topicId,
      title: s.title,
      topicTitle: s.topic.title,
    })),
    ...matchingArguments.map((a) => {
      const scheme = getSchemeById(a.schemeId);
      const variables = a.variables.map((v) => ({
        variableId: v.variableId,
        value: v.value,
      }));
      const renderedText = scheme ? renderArgumentText(scheme.conclusion, variables) : a.schemeId;
      return {
        type: "argument" as const,
        id: a.id,
        schemeId: a.schemeId,
        subtopicId: a.subtopicId,
        subtopicTitle: a.subtopic.title,
        topicTitle: a.subtopic.topic.title,
        renderedText,
        status: a.status as "IN" | "OUT" | "UNDECIDED",
      };
    }),
  ];

  const total = allResults.length;
  const paginated = allResults.slice(skip, skip + limit);

  return { results: paginated, total };
}
