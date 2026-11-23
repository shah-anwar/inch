import type { SearchResult } from "@inch/types";
import { getSchemeById } from "@inch/types";
import { FolderOpen, FileText, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";

interface SearchResultRowProps {
  result: SearchResult;
  onSelect: () => void;
  /**
   * When set (e.g. navbar quick results), rows are separated by lines and use
   * alternating backgrounds. Omit on full search page for the previous flat style.
   */
  rowIndex?: number;
}

/** Truncates long labels/snippets to fit row layout. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Renders one search result row with type-specific icon and metadata.
 *
 * @param props Search result payload and selection callback.
 * @returns Row button UI for topic, subtopic, or argument matches.
 */
export function SearchResultRow({ result, onSelect, rowIndex }: SearchResultRowProps) {
  const striped = rowIndex !== undefined;
  const i = rowIndex ?? 0;
  // Explicit neutrals so stripes stay visible on `bg-popover` (muted/opacity pairs did not).
  const rowSurface = striped
    ? i % 2 === 0
      ? "bg-neutral-200/90 dark:bg-neutral-800"
      : "bg-neutral-50 dark:bg-neutral-950"
    : "";
  const rowBorder = striped && i > 0 ? "border-t border-border" : "";
  const rowInteractive = striped
    ? "rounded-none transition-[filter] hover:brightness-95 dark:hover:brightness-110"
    : "rounded hover:bg-muted";

  if (result.type === "topic") {
    const desc = result.description ? truncate(result.description, 60) : null;
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-2 px-3 py-2 text-left",
          rowInteractive,
          rowSurface,
          rowBorder,
        )}
      >
        <FolderOpen className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{result.title}</div>
          {desc && <div className="text-sm text-muted-foreground truncate">{desc}</div>}
        </div>
      </button>
    );
  }

  if (result.type === "subtopic") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-2 px-3 py-2 text-left",
          rowInteractive,
          rowSurface,
          rowBorder,
        )}
      >
        <FileText
          className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{result.title}</div>
          <div className="text-sm text-muted-foreground">in {result.topicTitle}</div>
        </div>
      </button>
    );
  }

  // result.type === "argument"
  const scheme = getSchemeById(result.schemeId);
  const schemeName = scheme?.name ?? result.schemeId;
  const textSnippet = truncate(result.renderedText, 80);
  const statusColors =
    result.status === "IN"
      ? "bg-green-500/20 text-green-700 dark:text-green-400"
      : result.status === "OUT"
        ? "bg-red-500/20 text-red-700 dark:text-red-400"
        : "bg-muted text-muted-foreground";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2 px-3 py-2 text-left",
        rowInteractive,
        rowSurface,
        rowBorder,
      )}
    >
      <MessageSquare
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{schemeName}</div>
        <div className="text-sm text-muted-foreground truncate">{textSnippet}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          in {result.subtopicTitle} &gt; {result.topicTitle}
        </div>
        <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${statusColors}`}>
          {result.status}
        </span>
      </div>
    </button>
  );
}
