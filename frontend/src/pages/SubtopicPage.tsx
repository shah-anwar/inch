import type { ArgumentWithChildrenByStatus } from "@inch/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArgumentView } from "@/components/ArgumentView";
import { CounterArgumentDrawer } from "@/components/CounterArgumentDrawer";
import { InitialArgumentDrawer } from "@/components/InitialArgumentDrawer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useSubtopic, useSubtopicArguments, useTopic } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { setPageTitle } from "@/lib/pageTitle";
import { useDebateStore } from "@/stores/debateStore";

type SortOption = "most_debated" | "newest" | "oldest" | "status" | "most_viewed";

const STATUS_ORDER: Record<string, number> = {
  IN: 0,
  UNDECIDED: 1,
  OUT: 2,
};

/**
 * Sorts initial arguments for subtopic listings using the selected criterion.
 *
 * @param args Initial arguments in a subtopic.
 * @param sort Selected sort mode.
 * @returns New sorted array without mutating source.
 */
function sortArguments(
  args: ArgumentWithChildrenByStatus[],
  sort: SortOption,
): ArgumentWithChildrenByStatus[] {
  const copy = [...args];
  switch (sort) {
    case "most_debated":
      return copy.sort((a, b) => b.descendantCount - a.descendantCount);
    case "newest":
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest":
      return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "most_viewed":
      return copy.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    case "status":
      return copy.sort((a, b) => (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1));
  }
}

/**
 * Subtopic exploration page listing root arguments and opening initial-argument creation.
 *
 * @returns Subtopic page UI for `/topics/:topicId/:subtopicId`.
 */
export default function SubtopicPage() {
  const { topicId: topicIdParam, subtopicId: subtopicIdParam } = useParams<
    "topicId" | "subtopicId"
  >();
  const topicId = useMemo(() => {
    const n = topicIdParam ? parseInt(topicIdParam, 10) : NaN;
    return Number.isNaN(n) ? null : n;
  }, [topicIdParam]);
  const subtopicId = useMemo(() => {
    const n = subtopicIdParam ? parseInt(subtopicIdParam, 10) : NaN;
    return Number.isNaN(n) ? null : n;
  }, [subtopicIdParam]);

  const navigate = useNavigate();
  const location = useLocation();
  const { data: topic } = useTopic(topicId);
  const { data: subtopic } = useSubtopic(topicId, subtopicId);
  const {
    data: allArguments,
    isLoading: argsLoading,
    error: argsError,
    refetch: refetchArguments,
  } = useSubtopicArguments(subtopicId);

  const selectTopic = useDebateStore((s) => s.selectTopic);
  const selectSubtopic = useDebateStore((s) => s.selectSubtopic);
  const { token } = useAuth();

  const [sort, setSort] = useState<SortOption>("most_debated");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [attackDrawerOpen, setAttackDrawerOpen] = useState(false);
  const [attackParent, setAttackParent] = useState<ArgumentWithChildrenByStatus | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!token) {
      setAttackDrawerOpen(false);
      setAttackParent(null);
    }
  }, [token]);

  useEffect(() => {
    if (topic && subtopic && topicId !== null && subtopicId !== null) {
      selectTopic({
        id: topic.id,
        title: topic.title,
        description: topic.description ?? null,
      });
      selectSubtopic({
        id: subtopic.id,
        topicId: subtopic.topicId,
        title: subtopic.title,
      });
    }
  }, [topic, subtopic, topicId, subtopicId, selectTopic, selectSubtopic]);

  useEffect(() => {
    if (subtopic?.title) {
      setPageTitle(subtopic.title);
      return;
    }
    setPageTitle("Topics");
  }, [subtopic?.title]);

  const initialArguments = useMemo(() => {
    if (!allArguments) return [];
    return allArguments.filter((a) => a.isInitial === true);
  }, [allArguments]);

  const sortedArguments = useMemo(
    () => sortArguments(initialArguments, sort),
    [initialArguments, sort],
  );

  if (topicId === null || subtopicId === null) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Invalid topic or subtopic.</p>
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
      <div className="container mx-auto px-4 py-8">
        <Link to={`/topics/${topicId}`} className="mb-4 inline-block text-primary hover:underline">
          ← Back to {topic?.title ?? "Topic"}
        </Link>
        <h1 className="mb-6 text-2xl font-bold">{subtopic?.title ?? "Subtopic"}</h1>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={sort === "most_debated" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("most_debated")}
            >
              Most Debated
            </Button>
            <Button
              variant={sort === "newest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("newest")}
            >
              Newest
            </Button>
            <Button
              variant={sort === "oldest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("oldest")}
            >
              Oldest
            </Button>
            <Button
              variant={sort === "status" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("status")}
            >
              By Status
            </Button>
            <Button
              variant={sort === "most_viewed" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("most_viewed")}
            >
              Most Viewed
            </Button>
          </div>
          <Button
            id="start-argument-btn"
            size="sm"
            ref={startButtonRef}
            onClick={() => {
              if (!token) {
                navigate("/login", { state: { from: location } });
              } else {
                setDrawerOpen(true);
              }
            }}
          >
            Start Argument
          </Button>
        </div>

        {argsLoading && <p className="text-muted-foreground">Loading arguments…</p>}

        {argsError && (
          <div className="space-y-2">
            <p className="text-destructive">Failed to load arguments.</p>
            <Button variant="outline" size="sm" onClick={() => refetchArguments()}>
              Retry
            </Button>
          </div>
        )}

        {!argsLoading && !argsError && sortedArguments.length === 0 && (
          <p className="text-muted-foreground">No arguments yet. Be the first to start a debate.</p>
        )}

        {!argsLoading && !argsError && sortedArguments.length > 0 && (
          <div className="space-y-4">
            {sortedArguments.map((arg) => (
              <div
                key={arg.id}
                role="button"
                tabIndex={0}
                className="min-w-0 cursor-pointer rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate(`/arg/${arg.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/arg/${arg.id}`);
                  }
                }}
              >
                <ArgumentView
                  argument={arg}
                  parentSchemeId={
                    arg.parentId
                      ? sortedArguments.find((a) => a.id === arg.parentId)?.schemeId
                      : undefined
                  }
                  parentVariableValues={
                    arg.parentId
                      ? sortedArguments
                          .find((a) => a.id === arg.parentId)
                          ?.variables.map((v) => ({
                            variableId: v.variableId,
                            value: v.value,
                          }))
                      : undefined
                  }
                  compactCqChip
                  onAttack={(argumentId) => {
                    const target = sortedArguments.find((a) => a.id === argumentId);
                    if (!target) return;
                    if (!token) {
                      navigate("/login", { state: { from: location } });
                      return;
                    }
                    setAttackParent(target);
                    setAttackDrawerOpen(true);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <InitialArgumentDrawer
          subtopicId={subtopicId}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          triggerRef={startButtonRef}
          onSuccess={(newId) => {
            setDrawerOpen(false);
            navigate(`/arg/${newId}`);
          }}
        />

        {attackParent != null && token && (
          <CounterArgumentDrawer
            parentArgument={attackParent}
            open={attackDrawerOpen}
            onClose={() => {
              setAttackDrawerOpen(false);
              setAttackParent(null);
            }}
            onSuccess={(newId) => {
              setAttackDrawerOpen(false);
              setAttackParent(null);
              void refetchArguments();
              navigate(`/arg/${newId}`);
            }}
          />
        )}
      </div>
    </div>
  );
}
