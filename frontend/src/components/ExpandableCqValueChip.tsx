import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { truncateCqValueDisplay } from "@/constants";
import { cn } from "@/lib/utils";

export interface ExpandableCqValueChipProps {
  symbol: string;
  value: string;
}

const chipBase =
  "max-w-full rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs leading-snug align-middle break-words";

const chevronBtn =
  "inline-flex shrink-0 items-center justify-center rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";

/**
 * Inline chip for a CQ variable value: truncates per shared limits. Collapsed chip is
 * one control to expand. When expanded, the value is plain selectable text; only the
 * chevron control collapses so copy/select does not toggle the chip.
 */
export function ExpandableCqValueChip({ symbol, value }: ExpandableCqValueChipProps) {
  const truncated = truncateCqValueDisplay(value);
  const needsExpand = truncated !== value;
  const [expanded, setExpanded] = useState(false);
  const valueRegionId = useId();
  const groupLabelId = useId();

  if (!needsExpand) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5",
          chipBase,
        )}
      >
        <span className="shrink-0 text-muted-foreground">{symbol}:</span>
        <span className="min-w-0 select-text break-words text-foreground">{value}</span>
      </span>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        aria-labelledby={groupLabelId}
        aria-expanded={false}
        title="Click to show full value; you can then select and copy it"
        onClick={() => setExpanded(true)}
        className={cn(
          "inline-flex max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5 text-left",
          chipBase,
          "cursor-pointer transition-colors",
          "hover:bg-muted hover:shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <span id={groupLabelId} className="sr-only">
          Shortened value for {symbol}; activate to expand
        </span>
        <span
          className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5"
          aria-hidden
        >
          <span className="shrink-0 text-muted-foreground">{symbol}:</span>
          <span className="min-w-0 break-words text-foreground">{truncated}</span>
        </span>
        <ChevronDown
          className="mt-0.5 inline h-3.5 w-3.5 shrink-0 self-center transition-transform duration-200 ease-out motion-reduce:transition-none"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <span
      role="group"
      aria-labelledby={groupLabelId}
      className={cn(
        "inline-flex max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5",
        chipBase,
        "transition-colors",
      )}
    >
      <span id={groupLabelId} className="sr-only">
        Full value for {symbol}; use the chevron control to shorten again
      </span>
      <span className="shrink-0 select-none text-muted-foreground">{symbol}:</span>
      <span
        id={valueRegionId}
        className="min-w-0 cursor-text select-text break-words text-foreground"
      >
        {value}
      </span>
      <button
        type="button"
        aria-expanded={true}
        aria-controls={valueRegionId}
        title="Show shortened value"
        className={cn(chevronBtn, "mt-0.5 self-center")}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(false);
        }}
      >
        <ChevronDown
          className="h-3.5 w-3.5 rotate-180 transition-transform duration-200 ease-out motion-reduce:transition-none"
          aria-hidden
        />
        <span className="sr-only">Collapse to shortened value</span>
      </button>
    </span>
  );
}
