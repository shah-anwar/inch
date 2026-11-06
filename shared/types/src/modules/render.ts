/**
 * Substitutes variable values into a scheme conclusion template.
 *
 * Template tokens are `{variableId}` — e.g. `"Therefore, {claim} is true."`
 * If a token has no matching variable the token is left as-is.
 */
export function renderArgumentText(
  conclusionTemplate: string,
  variables: { variableId: string; value: string }[],
): string {
  const map = new Map(variables.map((v) => [v.variableId, v.value]));
  return conclusionTemplate.replace(/\{(\w+)\}/g, (match, id: string) =>
    map.has(id) ? map.get(id)! : match,
  );
}
