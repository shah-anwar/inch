import type { Topic } from "@inch/types";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useTopics } from "@/hooks/useApi";
import { formatListDate } from "@/lib/formatListDate";
import { setPageTitle } from "@/lib/pageTitle";
import { cn } from "@/lib/utils";
import { useDebateStore } from "@/stores/debateStore";

type TopicSort = "newest" | "oldest" | "alpha";

/**
 * Topic list row that stores selected topic context before route transition.
 *
 * @param props Topic to render.
 * @returns Clickable topic row.
 */
function TopicListRow({ topic, rowIndex }: { topic: Topic; rowIndex: number }) {
  const selectTopic = useDebateStore((s) => s.selectTopic);
  const created = formatListDate(topic.createdAt);

  const handleClick = () => {
    selectTopic({
      id: topic.id,
      title: topic.title,
      description: topic.description,
    });
  };

  return (
    <Link
      to={`/topics/${topic.id}`}
      onClick={handleClick}
      className={cn(
        "block border-b border-border px-4 py-2.5 transition-colors last:border-b-0",
        rowIndex % 2 === 0 ? "bg-muted/25" : "bg-background",
        "hover:bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-snug">{topic.title}</h3>
          {topic.description ? (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{topic.description}</p>
          ) : null}
          {created ? (
            <p className="mt-0.5 text-xs italic text-muted-foreground">Created {created}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">Open →</span>
      </div>
    </Link>
  );
}

/**
 * Topic index page for top-level debate domains.
 *
 * @returns Topics page content with loading and empty states.
 */
export default function TopicsPage() {
  const { data: topics, isLoading, error } = useTopics();
  const clearSelection = useDebateStore((s) => s.clearSelection);
  const [sort, setSort] = useState<TopicSort>("alpha");

  const sortedTopics = useMemo(() => {
    if (!topics?.length) return [];
    const copy = [...topics];
    switch (sort) {
      case "newest":
        return copy.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case "oldest":
        return copy.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      case "alpha":
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return copy;
    }
  }, [topics, sort]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection]);

  useEffect(() => {
    setPageTitle("Topics");
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading topics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-destructive">Failed to load topics.</p>
        </div>
      </div>
    );
  }

  if (!topics?.length) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">No topics yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-1 text-2xl font-bold">Topics</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Browse categories. Open one to see its subtopics.
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div
            className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            role="toolbar"
            aria-label="Sort topics"
          >
            <span className="mr-1 text-xs font-medium text-muted-foreground">Sort:</span>
            <Button
              type="button"
              variant={sort === "alpha" ? "default" : "outline"}
              size="xs"
              onClick={() => setSort("alpha")}
            >
              A–Z
            </Button>
            <Button
              type="button"
              variant={sort === "oldest" ? "default" : "outline"}
              size="xs"
              onClick={() => setSort("oldest")}
            >
              Oldest
            </Button>
            <Button
              type="button"
              variant={sort === "newest" ? "default" : "outline"}
              size="xs"
              onClick={() => setSort("newest")}
            >
              Newest
            </Button>
          </div>
          {sortedTopics.map((topic, index) => (
            <TopicListRow key={topic.id} topic={topic} rowIndex={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
