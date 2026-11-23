import { getSchemeById, renderArgumentText } from "@inch/types";
import type { ArgumentWithChildrenByStatus } from "@inch/types";
import { CriticalQuestionResolved } from "@/components/CriticalQuestionResolved";
import { formatSubmittedAtLocal } from "@/lib/formatSubmittedAt";

export interface ArgumentDetailBodyProps {
  argument: ArgumentWithChildrenByStatus;
  /** Scheme id + values used to resolve CQ placeholders (parent scheme/vars when countering). */
  cqSubstitution?: {
    schemeId: string;
    cqId: string;
    variableValues: { variableId: string; value: string }[];
  } | null;
}

/**
 * Read-only argument detail blocks (argument text, submitted, scheme, CQ, variables).
 * Shared by the argument page left column and the fullscreen graph side panel.
 */
export function ArgumentDetailBody({ argument, cqSubstitution }: ArgumentDetailBodyProps) {
  const scheme = getSchemeById(argument.schemeId);
  const schemeName = scheme?.name ?? argument.schemeId;

  const argumentBody =
    argument.argumentText?.trim() ||
    (scheme
      ? renderArgumentText(
          scheme.conclusion,
          (argument.variables ?? []).map((v) => ({
            variableId: v.variableId,
            value: v.value,
          })),
        )
      : "");

  const variables = argument.variables ?? [];

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="argument-detail-heading"
        className="rounded-xl border-2 border-border bg-card p-4 shadow-md ring-1 ring-border/50"
      >
        <h2
          id="argument-detail-heading"
          className="mb-2.5 border-b-2 border-primary/25 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground"
        >
          Argument
        </h2>
        <p className="text-balance text-sm font-semibold leading-relaxed text-foreground sm:text-base whitespace-pre-wrap">
          {argumentBody || "—"}
        </p>
      </section>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Submitted
        </p>
        <time
          className="font-mono text-sm tabular-nums text-foreground"
          dateTime={argument.createdAt}
          title="Your local date, time, and zone abbreviation"
        >
          {formatSubmittedAtLocal(argument.createdAt)}
        </time>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Scheme
        </p>
        <p className="text-sm text-foreground">{schemeName}</p>
      </div>

      {argument.selectedCqId != null && cqSubstitution != null && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Critical Question
          </p>
          <CriticalQuestionResolved
            schemeId={cqSubstitution.schemeId}
            cqId={cqSubstitution.cqId}
            variableValues={cqSubstitution.variableValues}
          />
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Variables
        </p>
        {variables.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1.5 pr-4 text-left text-xs font-medium text-muted-foreground">
                  Name
                </th>
                <th className="py-1.5 text-left text-xs font-medium text-muted-foreground">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => {
                const varDef = scheme?.variables.find((def) => def.id === v.variableId);
                const name = varDef?.name ?? v.variableId;
                return (
                  <tr key={v.variableId} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-4 align-top font-mono text-xs text-muted-foreground">
                      {name}
                    </td>
                    <td className="break-words py-1.5 align-top text-xs text-foreground">
                      {v.value}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
