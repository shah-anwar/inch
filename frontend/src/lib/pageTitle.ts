const APP_NAME = "INCH";

/**
 * Sets the browser tab title with the shared app suffix.
 *
 * @param prefix Leading title content before app name.
 */
export function setPageTitle(prefix: string): void {
  document.title = `${prefix} | ${APP_NAME}`;
}

/**
 * Produces a page title for a single argument detail tab.
 *
 * @param argumentText Full argument text content.
 * @param status Current argument status.
 * @returns Formatted argument title string.
 */
export function formatArgumentPageTitle(
  argumentText: string | null | undefined,
  status: string | null | undefined,
): string {
  const text = (argumentText ?? "").trim();
  const preview = `${text.slice(0, 15)}...`;

  const normalized = (status ?? "").toUpperCase();
  const statusLabel =
    normalized === "IN" || normalized === "OUT"
      ? normalized
      : normalized === "UNDECIDED" || normalized === "UNDEC"
        ? "UNDEC"
        : "UNDEC";

  return `${preview} - ${statusLabel}`;
}
