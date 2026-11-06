/**
 * Shared frontend configuration — single place to tune limits used in multiple components.
 */
export const UI_LIMITS = {
  /** Max characters shown in critical-question variable value chips before ellipsis. */
  cqValueChipMaxChars: 50,
  /** Max characters of each substituted value in CQ preview on argument list cards. */
  cqListVariableMaxChars: 20,
} as const;

/** Keyed config object for unified imports; values are literal types. */
export type UILimits = typeof UI_LIMITS;

/**
 * Truncates a string for inline CQ value chips using {@link UI_LIMITS.cqValueChipMaxChars}.
 */
export function truncateCqValueDisplay(value: string): string {
  const max = UI_LIMITS.cqValueChipMaxChars;
  if (value.length <= max) return value;
  return value.slice(0, max - 3) + "…";
}

/** Truncates substituted variable values in list-style CQ: chips (see {@link UI_LIMITS.cqListVariableMaxChars}). */
export function truncateCqListVariableValue(value: string): string {
  const max = UI_LIMITS.cqListVariableMaxChars;
  if (value.length <= max) return value;
  return value.slice(0, max) + "…";
}
