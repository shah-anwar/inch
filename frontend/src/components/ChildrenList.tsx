import type { ArgumentWithChildrenByStatus, ChildrenSort } from "@inch/types";
import { useState } from "react";
import { ArgumentView } from "@/components/ArgumentView";
import { Button } from "@/components/ui/button";
import { useArgumentChildren } from "@/hooks/useApi";

interface ChildrenListProps {
  argumentId: string;
  /** Depth of the parent argument (0 = initial). Children get parentDepth + 1. */
  parentDepth: number;
  /** Scheme ID of the parent argument (so child CQ text can be resolved). */
  parentSchemeId?: string;
  /** Parent argument variable values (substitute into CQ template for each child card). */
  parentVariableValues?: { variableId: string; value: string }[];
  onChildClick: (argumentId: string) => void;
}

const SORT_OPTIONS: { value: ChildrenSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_descendants", label: "Most Debated" },
  { value: "status", label: "By Status" },
  { value: "most_viewed", label: "Most Viewed" },
];

/**
 * Displays paginated direct counter-arguments for a parent argument with sort controls.
 *
 * @param props Parent argument context and navigation callback for selected children.
 * @returns Sorted and pageable child argument list.
 */
export function ChildrenList({
  argumentId,
  parentDepth,
  parentSchemeId,
  parentVariableValues,
  onChildClick,
}: ChildrenListProps) {
  const [sort, setSort] = useState<ChildrenSort>("newest");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const { data, isLoading, isFetching } = useArgumentChildren(argumentId, {
    limit: 10,
    sort,
    after: cursor,
  });

  const handleSortChange = (newSort: ChildrenSort) => {
    setSort(newSort);
    setCursor(undefined);
    setCursorHistory([]);
  };

  const handleNext = () => {
    if (data?.nextCursor != null) {
      setCursorHistory((h) => (cursor != null ? [...h, cursor] : h));
      setCursor(data.nextCursor);
    }
  };

  const handlePrevious = () => {
    if (cursorHistory.length > 0) {
      const nextHistory = cursorHistory.slice(0, -1);
      const prevCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory(nextHistory);
      setCursor(prevCursor);
    } else {
      setCursor(undefined);
      setCursorHistory([]);
    }
  };

  const children = data?.children ?? [];
  const hasNext = data?.nextCursor != null;
  const hasPrevious = cursorHistory.length > 0 || cursor !== undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SORT_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={sort === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isLoading || isFetching ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      ) : children.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No counter-arguments yet.</p>
      ) : (
        <>
          <ul className="space-y-2 list-none p-0 m-0">
            {children.map((child: ArgumentWithChildrenByStatus) => (
              <li key={child.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full min-w-0 text-left rounded-lg hover:bg-muted/50 transition-colors cursor-pointer p-3"
                  onClick={() => onChildClick(child.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onChildClick(child.id);
                    }
                  }}
                >
                  <ArgumentView
                    argument={child}
                    depth={parentDepth + 1}
                    parentSchemeId={parentSchemeId}
                    parentVariableValues={parentVariableValues}
                    compactCqChip
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={!hasPrevious} onClick={handlePrevious}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={handleNext}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
