import type {
  SearchResult,
  SearchResultTopic,
  SearchResultSubtopic,
  SearchResultArgument,
} from "@inch/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SearchResultRow } from "@/components/SearchResultRow";
import { useSearch } from "@/hooks/useApi";

const RESULTS_PER_PAGE = 10;

/**
 * Buckets mixed search results by entity type for sectioned rendering.
 *
 * @param results Flat search result list.
 * @returns Grouped result buckets.
 */
function groupResults(results: SearchResult[]) {
  const topics: SearchResultTopic[] = [];
  const subtopics: SearchResultSubtopic[] = [];
  const arguments_: SearchResultArgument[] = [];
  for (const r of results) {
    if (r.type === "topic") topics.push(r);
    else if (r.type === "subtopic") subtopics.push(r);
    else arguments_.push(r);
  }
  return { topics, subtopics, arguments: arguments_ };
}

/**
 * Search results page with grouped sections and server-side pagination controls.
 *
 * @returns Search page UI for `/search`.
 */
export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));

  const { data, isLoading, isError, error } = useSearch(
    q,
    page,
    q.trim().length > 0,
    RESULTS_PER_PAGE,
  );

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    navigate(`/search?${params.toString()}`);
  };

  if (isError) {
    const message = error instanceof Error ? error.message : "Search failed";
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <p className="text-destructive">Error: {message}</p>
      </div>
    );
  }

  if (!q.trim()) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-xl font-semibold mb-4">Search</h1>
        <p className="text-muted-foreground">
          Enter a search term in the navbar to find topics, subtopics, and arguments.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-xl font-semibold mb-4">Search results for &quot;{q}&quot;</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const { results, total, totalPages } = data ?? {
    results: [],
    total: 0,
    totalPages: 0,
  };

  if (results.length === 0) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-xl font-semibold mb-4">Search results for &quot;{q}&quot;</h1>
        <p className="text-muted-foreground">No results for &quot;{q}&quot;.</p>
      </div>
    );
  }

  const { topics, subtopics, arguments: arguments_ } = groupResults(results);

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold mb-4">Search results for &quot;{q}&quot;</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {total} result{total !== 1 ? "s" : ""}
      </p>

      <div className="space-y-8">
        {topics.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Topics</h2>
            <ul className="rounded-md border divide-y">
              {topics.map((result) => (
                <li key={`topic-${result.id}`}>
                  <SearchResultRow
                    result={result}
                    onSelect={() => navigate(`/topics/${result.id}`)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {subtopics.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Subtopics</h2>
            <ul className="rounded-md border divide-y">
              {subtopics.map((result) => (
                <li key={`subtopic-${result.id}`}>
                  <SearchResultRow
                    result={result}
                    onSelect={() => navigate(`/topics/${result.topicId}/${result.id}`)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {arguments_.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Arguments</h2>
            <ul className="rounded-md border divide-y">
              {arguments_.map((result) => (
                <li key={`argument-${result.id}`}>
                  <SearchResultRow result={result} onSelect={() => navigate(`/arg/${result.id}`)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded border bg-background hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
          >
            <ChevronLeft className="size-4" />
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded border bg-background hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
