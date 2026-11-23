import type { AncestorNode } from "@inch/types";

interface CondensedViewProps {
  ancestors: AncestorNode[];
  currentArgumentId: string;
  onArgumentClick: (argumentId: string) => void;
  submittedByUserIds?: Set<string>;
}

const statusBorder: Record<string, string> = {
  IN: "border-green-500",
  OUT: "border-red-500",
  UNDECIDED: "border-amber-500",
};
const statusIcon: Record<string, string> = {
  IN: "✓",
  OUT: "✕",
  UNDECIDED: "?",
};
const statusIconColor: Record<string, string> = {
  IN: "text-green-500",
  OUT: "text-red-500",
  UNDECIDED: "text-amber-500",
};

/**
 * Renders the ancestor thread as a compact, clickable sequence of arguments.
 *
 * @param props Ancestor nodes, current argument id, and click handler for navigation.
 * @returns Condensed thread UI used on argument detail pages.
 */
export function CondensedView({
  ancestors,
  currentArgumentId,
  onArgumentClick,
  submittedByUserIds,
}: CondensedViewProps) {
  return (
    <div className="space-y-0">
      {ancestors.map((ancestor) => {
        const isCurrent = ancestor.id === currentArgumentId;
        const border = statusBorder[ancestor.status] ?? "border-border";
        const isSubmittedByUser = submittedByUserIds?.has(ancestor.id) === true;

        return (
          <button
            key={ancestor.id}
            type="button"
            onClick={() => onArgumentClick(ancestor.id)}
            className={`w-full text-left border-l-2 ${border} bg-background text-foreground px-3 py-1.5 hover:bg-muted/50 transition-colors ${
              isCurrent ? "font-bold bg-muted/30" : ""
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{ancestor.schemeId}</span>
                  <span
                    className={`text-sm font-bold leading-none ${statusIconColor[ancestor.status] ?? "text-muted-foreground"}`}
                    aria-label={`Status: ${ancestor.status}`}
                    title={ancestor.status}
                  >
                    {statusIcon[ancestor.status] ?? "?"}
                  </span>
                  {isCurrent ? <span>(current)</span> : null}
                </div>
                {isSubmittedByUser ? (
                  <span className="text-[11px] text-muted-foreground">[Yours]</span>
                ) : null}
              </div>
              <p className="text-sm leading-snug text-foreground">{ancestor.argumentText}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
