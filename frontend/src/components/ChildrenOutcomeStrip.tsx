import type { ArgumentWithChildrenByStatus } from "@inch/types";
import { cn } from "@/lib/utils";

interface ChildrenOutcomeStripProps {
  argument: ArgumentWithChildrenByStatus;
  /** `compact` = table rows; `emphasized` = larger strip for section headers; `default` = list cards. */
  variant?: "default" | "compact" | "emphasized";
}

/**
 * IN / UNDECIDED / OUT child counts plus total descendant badge — same strip as {@link ArgumentView} list cards.
 */
export function ChildrenOutcomeStrip({ argument, variant = "default" }: ChildrenOutcomeStripProps) {
  const compact = variant === "compact";
  const emphasized = variant === "emphasized";
  const childrenByStatus = argument.childrenByStatus ?? {
    in: [],
    undecided: [],
    out: [],
  };
  const inCount = childrenByStatus.in.length;
  const undecCount = childrenByStatus.undecided.length;
  const outCount = childrenByStatus.out.length;
  const descendantCount = argument.descendantCount ?? 0;

  return (
    <div
      className={cn(
        "flex items-center justify-end",
        compact ? "gap-0.5" : emphasized ? "gap-2" : "flex-wrap gap-2",
      )}
    >
      <div
        className={cn(
          "flex overflow-hidden border border-border font-medium",
          compact ? "text-[10px]" : emphasized ? "text-sm" : "text-xs",
        )}
        aria-label={`Child outcomes: ${inCount} in, ${undecCount} undecided, ${outCount} out`}
      >
        <div
          className={cn(
            "flex items-center gap-0.5 bg-green-500/15 text-green-500",
            compact ? "px-1 py-0" : emphasized ? "px-2.5 py-1" : "px-2 py-0.5",
          )}
        >
          {inCount}
          <span aria-hidden="true">✓</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-0.5 border-x border-border bg-amber-500/15 text-amber-500",
            compact ? "px-1 py-0" : emphasized ? "px-2.5 py-1" : "px-2 py-0.5",
          )}
        >
          {undecCount}
          <span aria-hidden="true">?</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-0.5 bg-red-500/15 text-red-500",
            compact ? "px-1 py-0" : emphasized ? "px-2.5 py-1" : "px-2 py-0.5",
          )}
        >
          {outCount}
          <span aria-hidden="true">✕</span>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full bg-muted font-medium text-muted-foreground",
          compact
            ? "px-1 py-0 text-[10px]"
            : emphasized
              ? "px-2.5 py-1 text-sm"
              : "px-2 py-1 text-xs",
        )}
      >
        {descendantCount} des.
      </span>
    </div>
  );
}
