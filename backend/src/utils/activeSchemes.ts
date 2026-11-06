export type ActiveSchemeCriticalQuestion = {
  id: string;
  validResponseSchemeIds: string[];
};

export type ActiveSchemeRecord<TCriticalQuestion extends ActiveSchemeCriticalQuestion> = {
  id: string;
  criticalQuestions: TCriticalQuestion[];
};

/**
 * Whether `schemeId` may be used to answer `cq`. An empty list means any scheme
 * may respond (the CQ does not constrain the reply).
 *
 * This mirrors `getValidResponseSchemes` in @inch/types rather than calling it,
 * because that helper reads the static schemes.json registry while the backend
 * checks the admin-managed CQs stored in the database. Whether the scheme is
 * active is checked separately by the callers.
 */
export function allowsResponseScheme(
  cq: Pick<ActiveSchemeCriticalQuestion, "validResponseSchemeIds">,
  schemeId: string,
): boolean {
  return cq.validResponseSchemeIds.length === 0 || cq.validResponseSchemeIds.includes(schemeId);
}

/**
 * Returns critical questions that can still be attacked by at least one active response scheme.
 */
export function getVisibleCriticalQuestions<TCriticalQuestion extends ActiveSchemeCriticalQuestion>(
  activeSchemeIds: string[],
  criticalQuestions: TCriticalQuestion[],
): TCriticalQuestion[] {
  return criticalQuestions.filter((cq) =>
    activeSchemeIds.some((schemeId) => allowsResponseScheme(cq, schemeId)),
  );
}

/**
 * Returns active schemes that expose at least one visible critical question.
 */
export function getVisibleSchemes<
  TCriticalQuestion extends ActiveSchemeCriticalQuestion,
  TScheme extends ActiveSchemeRecord<TCriticalQuestion>,
>(activeSchemeIds: string[], allSchemesWithCqs: TScheme[]): TScheme[] {
  const activeSet = new Set(activeSchemeIds);
  return allSchemesWithCqs.filter(
    (scheme) =>
      activeSet.has(scheme.id) &&
      getVisibleCriticalQuestions(activeSchemeIds, scheme.criticalQuestions).length > 0,
  );
}
