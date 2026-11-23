import { prisma } from "@db/prisma.js";

/**
 * Scheme row fields needed to build LLM prompts and validate suggestion output.
 * The available set is whatever exists in the database (admin-managed).
 */
export type SchemeForSuggestion = {
  id: string;
  name: string;
  description: string;
  variables: unknown;
};

/**
 * Lists all schemes for suggestion and structured-argument flows.
 * Ordering is stable so prompts stay deterministic.
 */
export async function listSchemesForSuggestion(): Promise<SchemeForSuggestion[]> {
  return prisma.scheme.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      variables: true,
    },
  });
}
