import { getSchemeById, getCriticalQuestion, renderArgumentText } from "@inch/types";
import type { ArgumentWithChildrenByStatus } from "@inch/types";
import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { ChildrenOutcomeStrip } from "@/components/ChildrenOutcomeStrip";
import { truncateCqListVariableValue } from "@/constants";
import { getCriticalQuestionSegments, type CqSegment } from "@/lib/argumentForm";
import { formatSubmittedAtLocal } from "@/lib/formatSubmittedAt";
import { cn } from "@/lib/utils";

interface ArgumentViewProps {
  argument: ArgumentWithChildrenByStatus;
  parentSchemeId?: string;
  /** Parent argument variable bindings (CQ chip on counter-argument cards uses parent scheme). */
  parentVariableValues?: { variableId: string; value: string }[];
  /** Depth in thread (0 = initial). Even = rounded, odd = square. If omitted, derived from isInitial. */
  depth?: number;
  onAttack?: (argumentId: string) => void;
  attackButtonRef?: React.RefObject<HTMLButtonElement | null>;
  /** When true, the counter-attack drawer is open: attack control shows ATTACKING and is disabled. */
  counterAttackDrawerOpen?: boolean;
  /** Single-line CQ chip with ellipsis; uses remaining row width on list cards. */
  compactCqChip?: boolean;
}

const statusIcon: Record<string, string> = {
  IN: "✓",
  OUT: "✕",
  UNDECIDED: "?",
};

const statusBorder: Record<string, string> = {
  IN: "border-green-500",
  OUT: "border-red-500",
  UNDECIDED: "border-amber-500",
};

const statusColor: Record<string, string> = {
  IN: "text-green-500",
  OUT: "text-red-500",
  UNDECIDED: "text-amber-500",
};

function cqChipPlainText(segments: CqSegment[], truncateVariableValues: boolean): string {
  return segments
    .map((s) =>
      s.type === "text"
        ? s.content
        : `[${truncateVariableValues ? truncateCqListVariableValue(s.value) : s.value}]`,
    )
    .join("");
}

/**
 * Renders a single argument card with status, selected scheme/CQ context, variables,
 * aggregate child outcome counts, and optional attack action.
 *
 * @param props Component props for the argument card and optional interaction hooks.
 * @returns Argument card UI used across detail and list contexts.
 */
export function ArgumentView({
  argument,
  parentSchemeId,
  parentVariableValues,
  depth,
  onAttack,
  attackButtonRef,
  counterAttackDrawerOpen = false,
  compactCqChip = false,
}: ArgumentViewProps) {
  const [open, setOpen] = useState(false);

  const scheme = getSchemeById(argument.schemeId);
  const schemeName = scheme?.name ?? argument.schemeId;
  const text = useMemo(() => {
    const nl = argument.argumentText?.trim();
    if (nl != null && nl.length > 0) return nl;
    if (!scheme) return "";
    return renderArgumentText(
      scheme.conclusion,
      (argument.variables ?? []).map((v) => ({
        variableId: v.variableId,
        value: v.value,
      })),
    );
  }, [argument.argumentText, argument.variables, scheme]);
  const variables = argument.variables ?? [];

  const cqChip = useMemo(() => {
    const cqId = argument.selectedCqId;
    if (cqId == null) return null;
    const cqSchemeId = parentSchemeId ?? argument.schemeId;
    const cqDef = getCriticalQuestion(cqSchemeId, cqId);
    const schemeForCq = getSchemeById(cqSchemeId);
    if (!cqDef || !schemeForCq) return null;
    const valueSource =
      parentVariableValues ??
      (argument.variables ?? []).map((v) => ({
        variableId: v.variableId,
        value: v.value,
      }));
    const segments = getCriticalQuestionSegments(
      cqDef.text,
      schemeForCq.variables.map((v) => ({ id: v.id, name: v.name })),
      valueSource,
    );
    const display = cqChipPlainText(segments, true).trim();
    const full = cqChipPlainText(segments, false).trim();
    const text = display.length > 0 ? display : cqDef.text.trim() || cqDef.text;
    const titleText = full.length > 0 ? full : cqDef.text.trim() || cqDef.text;
    return { text, titleText };
  }, [
    argument.schemeId,
    argument.selectedCqId,
    argument.variables,
    parentSchemeId,
    parentVariableValues,
  ]);

  const borderColor = statusBorder[argument.status] ?? "border-border";
  const isRound = depth !== undefined ? depth % 2 === 0 : argument.isInitial;
  const roundedClass = isRound ? "rounded-2xl" : "rounded-none";

  const viewCount = argument.viewCount ?? 0;
  const attackLabel =
    onAttack != null
      ? counterAttackDrawerOpen
        ? "Counter-attack in progress"
        : `Attack argument: ${text.slice(0, 60)}`
      : undefined;

  return (
    <div
      className={cn(
        `${roundedClass} border-2 ${borderColor} bg-background text-foreground p-4 space-y-3`,
        compactCqChip && "min-w-0",
      )}
      role="article"
    >
      {/* Top row: scheme, CQ, submitted time + status icon */}
      <div
        className={cn(
          "flex items-center gap-2 min-w-0",
          compactCqChip ? "w-full flex-nowrap" : "flex-wrap justify-between",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 min-w-0",
            compactCqChip ? "min-w-0 flex-1 flex-nowrap overflow-hidden" : "flex-wrap",
          )}
        >
          <span className="shrink-0 px-2 py-0.5 rounded-sm border border-border bg-muted text-muted-foreground text-xs font-medium">
            Scheme: {schemeName}
          </span>
          {cqChip != null && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-sm border border-border bg-muted text-muted-foreground text-xs font-medium",
                compactCqChip
                  ? "min-w-0 max-w-[28rem] overflow-hidden text-ellipsis whitespace-nowrap"
                  : "max-w-[min(100%,28rem)] break-words",
              )}
              title={cqChip.titleText}
            >
              CQ: {cqChip.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <time
            className="text-xs text-muted-foreground/80 font-mono tabular-nums"
            dateTime={argument.createdAt}
            title="Submitted in your local time"
          >
            {formatSubmittedAtLocal(argument.createdAt)}
          </time>
          <span
            className={`text-sm font-bold ${statusColor[argument.status] ?? "text-muted-foreground"}`}
            aria-label={`Status: ${argument.status}`}
          >
            {statusIcon[argument.status]}
          </span>
        </div>
      </div>

      {/* Argument text */}
      <h3 className="text-sm leading-relaxed font-medium">{text}</h3>

      {/* Bottom row: variables dropdown + children widget */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{open ? "▾" : "▸"}</span>
            <span>Variables ({variables.length})</span>
          </button>
          {open && (
            <table className="text-xs border-collapse mt-1">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 pr-6 text-muted-foreground font-medium">Name</th>
                  <th className="text-left py-1 text-muted-foreground font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((v) => {
                  const varDef = scheme?.variables.find((vdef) => vdef.id === v.variableId);
                  const name = varDef?.name ?? v.variableId;
                  return (
                    <tr key={v.variableId} className="border-b border-border last:border-0">
                      <td className="py-1 pr-6 font-mono text-muted-foreground">{name}</td>
                      <td className="py-1 text-foreground">{v.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ChildrenOutcomeStrip argument={argument} />
          {viewCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              <Eye className="h-3 w-3" aria-hidden="true" />
              {viewCount}
            </span>
          )}
          {onAttack != null && (
            <button
              type="button"
              disabled={counterAttackDrawerOpen}
              onClick={(e) => {
                e.stopPropagation();
                if (counterAttackDrawerOpen) return;
                onAttack(argument.id);
              }}
              className="px-2 py-0.5 rounded border-2 border-red-500 text-red-500 text-xs font-semibold hover:bg-red-500 hover:text-white transition-colors disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-red-500"
              aria-label={attackLabel}
              ref={attackButtonRef}
            >
              {counterAttackDrawerOpen ? "ATTACKING" : "Attack"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
