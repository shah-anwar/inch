import type { Subtopic, Topic } from "@inch/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useTopic, useSubtopics } from "@/hooks/useApi";
import { formatListDate } from "@/lib/formatListDate";
import { setPageTitle } from "@/lib/pageTitle";
import { cn } from "@/lib/utils";
import { useDebateStore } from "@/stores/debateStore";

type SubtopicSort = "newest" | "oldest" | "alpha";

/**
 * Subtopic list row that persists selected topic/subtopic context.
 *
 * @param props Subtopic and parent topic context.
 * @returns Clickable subtopic row.
 */
function SubtopicListRow({
  subtopic,
  topic,
  topicId,
  rowIndex,
}: {
  subtopic: Subtopic;
  topic: Topic | undefined;
  topicId: number;
  rowIndex: number;
}) {
  const selectSubtopic = useDebateStore((s) => s.selectSubtopic);
  const selectTopic = useDebateStore((s) => s.selectTopic);
  const created = formatListDate(subtopic.createdAt);

  const handleClick = () => {
    if (topic) {
      selectTopic({
        id: topic.id,
        title: topic.title,
        description: topic.description ?? null,
      });
    }
    selectSubtopic({
      id: subtopic.id,
      topicId: subtopic.topicId,
      title: subtopic.title,
    });
  };

  return (
    <Link
      to={`/topics/${topicId}/${subtopic.id}`}
      onClick={handleClick}
      className={cn(
        "block border-b border-border px-4 py-2.5 transition-colors last:border-b-0",
        rowIndex % 2 === 0 ? "bg-muted/25" : "bg-background",
        "hover:bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-snug">{subtopic.title}</h3>
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
 * Page listing subtopics for a selected topic.
 *
 * @returns Subtopic listing page with route validation and loading/error states.
 */
export default function SubtopicsPage() {
  const { topicId: topicIdParam } = useParams<"topicId">();
  const topicId = useMemo(() => {
    const n = topicIdParam ? parseInt(topicIdParam, 10) : NaN;
    return Number.isNaN(n) ? null : n;
  }, [topicIdParam]);

  const { data: topic, isLoading: topicLoading, error: topicError } = useTopic(topicId);
  const {
    data: subtopics,
    isLoading: subtopicsLoading,
    error: subtopicsError,
  } = useSubtopics(topicId);

  const selectTopic = useDebateStore((s) => s.selectTopic);
  const [sort, setSort] = useState<SubtopicSort>("alpha");

  const sortedSubtopics = useMemo(() => {
    if (!subtopics?.length) return [];
    const copy = [...subtopics];
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
  }, [subtopics, sort]);

  useEffect(() => {
    if (topic && topicId !== null) {
      selectTopic({
        id: topic.id,
        title: topic.title,
        description: topic.description,
      });
    }
  }, [topic, topicId, selectTopic]);

  useEffect(() => {
    if (topic?.title) {
      setPageTitle(topic.title);
      return;
    }
    setPageTitle("Topics");
  }, [topic?.title]);

  const isLoading = topicLoading || subtopicsLoading;
  const error = topicError ?? subtopicsError;

  if (topicId === null) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Invalid topic.</p>
          <Link to="/topics" className="mt-2 inline-block text-primary hover:underline">
            ← Back to Topics
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-destructive">Failed to load topic or subtopics.</p>
          <Link to="/topics" className="mt-2 inline-block text-primary hover:underline">
            ← Back to Topics
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <Link to="/topics" className="mb-3 inline-block text-sm text-primary hover:underline">
          ← Back to Topics
        </Link>
        <h1 className="mb-1 text-2xl font-bold">{topic?.title ?? "Subtopic"}</h1>
        <p className="mb-4 text-sm text-muted-foreground">Pick a thread to open arguments.</p>

        {!subtopics?.length ? (
          <p className="text-muted-foreground">No subtopics yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div
              className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
              role="toolbar"
              aria-label="Sort subtopics"
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
            {sortedSubtopics.map((subtopic, index) => (
              <SubtopicListRow
                key={subtopic.id}
                subtopic={subtopic}
                topic={topic}
                topicId={topicId}
                rowIndex={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
