import { getSchemeById, renderArgumentText } from "@inch/types";
import type { AncestorNode } from "@inch/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArgumentGraph } from "@/components/ArgumentGraph";
import { ArgumentLeftDetailPanel } from "@/components/ArgumentLeftDetailPanel";
import { ChildrenList } from "@/components/ChildrenList";
import { CondensedView } from "@/components/CondensedView";
import { CounterArgumentDrawer } from "@/components/CounterArgumentDrawer";
import { Navbar } from "@/components/Navbar";
import {
  useArgument,
  useArgumentContext,
  useAncestors,
  useSubtopicArguments,
} from "@/hooks/useApi";
import { useArgumentUpdates } from "@/hooks/useArgumentUpdates";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";
import { formatArgumentPageTitle, setPageTitle } from "@/lib/pageTitle";
import { useDebateStore } from "@/stores";

/**
 * Argument detail page: left column shows subtopic graph and a full read-out of the
 * selected argument; right column shows the thread and counter-arguments.
 *
 * @returns Complete argument exploration surface for `/arg/:argumentId`.
 */
export default function ArgumentPage() {
  const { argumentId } = useParams<{ argumentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setArgumentPageBreadcrumb = useDebateStore((s) => s.setArgumentPageBreadcrumb);
  const { token } = useAuth();
  const user = useUserData();
  const currentUserId = typeof user?.id === "number" ? user.id : null;
  const [attackDrawerOpen, setAttackDrawerOpen] = useState(false);
  const attackButtonRef = useRef<HTMLButtonElement | null>(null);
  const threadPaneScrollRef = useRef<HTMLDivElement | null>(null);
  const [threadPaneHeight, setThreadPaneHeight] = useState(280);
  const threadPaneDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const NAVBAR_HEIGHT_PX = 40;
  const THREAD_PANE_MIN = 180;
  const COUNTER_PANE_MIN = 220;

  useEffect(() => {
    if (!token) setAttackDrawerOpen(false);
  }, [token]);

  const { data: context, isLoading: contextLoading } = useArgumentContext(argumentId ?? null);
  const { data: argument, isLoading: argumentLoading } = useArgument(argumentId ?? null);
  const { data: ancestorData } = useAncestors(argumentId ?? null);
  const { data: subtopicArgs } = useSubtopicArguments(context?.subtopic.id ?? null);

  useEffect(() => {
    if (argument != null) {
      setPageTitle(formatArgumentPageTitle(argument.argumentText, argument.status));
      return;
    }
    setPageTitle("Topics");
  }, [argument]);

  const threadAncestors = useMemo((): AncestorNode[] => {
    const textFallbackById = new Map<string, string>();
    for (const a of subtopicArgs ?? []) {
      const nl = a.argumentText?.trim();
      if (nl != null && nl.length > 0) {
        textFallbackById.set(a.id, nl);
        continue;
      }
      const scheme = getSchemeById(a.schemeId);
      if (!scheme) continue;
      textFallbackById.set(
        a.id,
        renderArgumentText(
          scheme.conclusion,
          (a.variables ?? []).map((v) => ({
            variableId: v.variableId,
            value: v.value,
          })),
        ),
      );
    }
    if (ancestorData?.ancestors != null && ancestorData.ancestors.length > 0) {
      return ancestorData.ancestors.map((ancestor) => {
        const nl = ancestor.argumentText?.trim();
        if (nl != null && nl.length > 0) return ancestor;
        return {
          ...ancestor,
          argumentText: textFallbackById.get(ancestor.id) ?? "",
        };
      });
    }
    if (argument == null) return [];
    const nl = argument.argumentText?.trim();
    let fallbackText = nl ?? "";
    if (fallbackText.length === 0) {
      const scheme = getSchemeById(argument.schemeId);
      if (scheme) {
        fallbackText = renderArgumentText(
          scheme.conclusion,
          (argument.variables ?? []).map((v) => ({
            variableId: v.variableId,
            value: v.value,
          })),
        );
      }
    }
    return [
      {
        id: argument.id,
        schemeId: argument.schemeId,
        argumentText: fallbackText,
        isInitial: argument.isInitial,
        status: argument.status,
        parentId: argument.parentId,
      },
    ];
  }, [ancestorData?.ancestors, argument, subtopicArgs]);

  const submittedByUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUserId == null) return ids;
    for (const arg of subtopicArgs ?? []) {
      if (arg.authorId === currentUserId) ids.add(arg.id);
    }
    return ids;
  }, [currentUserId, subtopicArgs]);

  const cqSubstitution = useMemo(() => {
    if (argument?.selectedCqId == null) return null;
    if (argument.parentId && subtopicArgs) {
      const parent = subtopicArgs.find((a) => a.id === argument.parentId);
      if (!parent) return null;
      return {
        schemeId: parent.schemeId,
        cqId: argument.selectedCqId,
        variableValues: (parent.variables ?? []).map((v) => ({
          variableId: v.variableId,
          value: v.value,
        })),
      };
    }
    return {
      schemeId: argument.schemeId,
      cqId: argument.selectedCqId,
      variableValues: (argument.variables ?? []).map((v) => ({
        variableId: v.variableId,
        value: v.value,
      })),
    };
  }, [argument, subtopicArgs]);

  const onArgumentStatusUpdates = useCallback(
    (updates: { id: string; status: string }[]) => {
      updates.forEach(({ id }) => {
        queryClient.invalidateQueries({ queryKey: ["argument", id] });
        queryClient.invalidateQueries({ queryKey: ["argument-context", id] });
      });
      if (argumentId) {
        queryClient.invalidateQueries({ queryKey: ["ancestors", argumentId] });
      }
      if (context?.subtopic.id != null) {
        queryClient.invalidateQueries({
          queryKey: ["subtopic-arguments", context.subtopic.id],
        });
      }
    },
    [queryClient, argumentId, context?.subtopic.id],
  );

  const onArgumentCreated = useCallback(
    (payload: { subtopicId: number; argumentId: string; parentId: string | null }) => {
      queryClient.invalidateQueries({
        queryKey: ["subtopic-arguments", payload.subtopicId],
      });

      // Refresh side panels and metadata on the open argument page.
      if (argumentId) {
        queryClient.invalidateQueries({ queryKey: ["argument", argumentId] });
        queryClient.invalidateQueries({ queryKey: ["argument-context", argumentId] });
        queryClient.invalidateQueries({ queryKey: ["ancestors", argumentId] });
        queryClient.invalidateQueries({ queryKey: ["argument-children", argumentId] });
      }

      // Ensure parent card counts/list refresh when a new direct child is inserted.
      if (payload.parentId != null) {
        queryClient.invalidateQueries({ queryKey: ["argument", payload.parentId] });
        queryClient.invalidateQueries({ queryKey: ["argument-children", payload.parentId] });
      }
    },
    [queryClient, argumentId],
  );

  useArgumentUpdates({
    subtopicId: context?.subtopic.id ?? null,
    onStatusUpdate: onArgumentStatusUpdates,
    onArgumentCreated,
  });

  useEffect(() => {
    if (!context) return;
    const s = useDebateStore.getState();
    if (
      s.selectedTopic?.id === context.topic.id &&
      s.selectedSubtopic?.id === context.subtopic.id &&
      s.selectedArgumentId === (argumentId ?? null)
    ) {
      return;
    }
    setArgumentPageBreadcrumb({
      topic: context.topic,
      subtopic: context.subtopic,
      argumentId: argumentId ?? null,
    });
  }, [context, argumentId, setArgumentPageBreadcrumb]);

  const goToArgument = useCallback(
    (id: string) => {
      if (id === argumentId) return;
      navigate(`/arg/${id}`);
    },
    [argumentId, navigate],
  );

  const isLoading = contextLoading || argumentLoading;
  const notFound =
    !contextLoading &&
    argumentId != null &&
    (context === undefined || argument === undefined) &&
    !contextLoading &&
    !argumentLoading;

  const threadSectionEnabled = argument != null && threadAncestors.length > 0;

  useEffect(() => {
    if (!threadSectionEnabled) return;
    const el = threadPaneScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadSectionEnabled, argumentId, threadAncestors.length]);

  const onThreadPaneResizePointerDown = useCallback(
    (e: { clientY: number; button: number; preventDefault: () => void }) => {
      if (e.button !== 0 || !threadSectionEnabled) return;
      e.preventDefault();
      const rightColumnHeight = window.innerHeight - NAVBAR_HEIGHT_PX;
      const maxHeight = Math.max(THREAD_PANE_MIN, rightColumnHeight - COUNTER_PANE_MIN);
      threadPaneDragRef.current = {
        startY: e.clientY,
        startHeight: Math.min(maxHeight, Math.max(THREAD_PANE_MIN, threadPaneHeight)),
      };

      const handleMove = (ev: PointerEvent) => {
        const drag = threadPaneDragRef.current;
        if (!drag) return;
        const rightColumnHeightNow = window.innerHeight - NAVBAR_HEIGHT_PX;
        const maxHeightNow = Math.max(THREAD_PANE_MIN, rightColumnHeightNow - COUNTER_PANE_MIN);
        const next = drag.startHeight + (ev.clientY - drag.startY);
        setThreadPaneHeight(Math.min(maxHeightNow, Math.max(THREAD_PANE_MIN, next)));
      };

      const endDrag = () => {
        threadPaneDragRef.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [threadPaneHeight, threadSectionEnabled],
  );

  if (notFound) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Argument not found</p>
          <Link to="/topics" className="text-primary hover:underline mt-2 inline-block">
            Back to topics
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="w-full min-h-[calc(100vh-2.5rem)]">
        {isLoading ? (
          <div className="p-6 space-y-4 max-w-4xl">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-24 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <div className="flex w-full min-h-[calc(100vh-2.5rem)]">
            <section className="w-1/3 min-h-0 h-[calc(100vh-2.5rem)] flex flex-shrink-0 flex-col overflow-hidden bg-background text-foreground">
              {argument != null && (
                <ArgumentLeftDetailPanel
                  argument={argument}
                  isSubmittedByUser={currentUserId != null && argument.authorId === currentUserId}
                  cqSubstitution={cqSubstitution}
                  graph={
                    subtopicArgs != null && argumentId != null ? (
                      <ArgumentGraph
                        arguments={subtopicArgs}
                        selectedArgumentId={argumentId}
                        onNodeClick={goToArgument}
                      />
                    ) : null
                  }
                  canOpenAttack={!!token}
                  attackDrawerOpen={attackDrawerOpen}
                  onAttackClick={() => {
                    if (!token) {
                      navigate("/login", { state: { from: location } });
                      return;
                    }
                    setAttackDrawerOpen(true);
                  }}
                  attackButtonRef={attackButtonRef}
                />
              )}
            </section>

            <div
              className="w-px shrink-0 bg-border self-stretch min-h-[calc(100vh-2.5rem)]"
              aria-hidden
            />

            <section className="flex-1 min-h-0 h-[calc(100vh-2.5rem)] overflow-hidden bg-background text-foreground p-6">
              <div className="flex h-full min-h-0 flex-col">
                {threadSectionEnabled && (
                  <section
                    className="min-h-0 overflow-hidden"
                    style={{ height: `${threadPaneHeight}px` }}
                  >
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Inference node chain
                    </h2>
                    <div
                      ref={threadPaneScrollRef}
                      className="h-[calc(100%-1.5rem)] overflow-y-auto rounded-md border border-border p-2"
                    >
                      <CondensedView
                        ancestors={threadAncestors}
                        currentArgumentId={argumentId ?? ""}
                        onArgumentClick={goToArgument}
                        submittedByUserIds={submittedByUserIds}
                      />
                    </div>
                  </section>
                )}

                {threadSectionEnabled && (
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize inference node chain section"
                    className="my-3 h-3 shrink-0 cursor-row-resize rounded bg-border/70 hover:bg-primary/40 flex items-center justify-center"
                    onPointerDown={onThreadPaneResizePointerDown}
                  >
                    <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/70" />
                  </div>
                )}

                {argumentId != null && (
                  <section className="min-h-0 flex-1 overflow-y-auto">
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Counter-arguments
                    </h2>
                    <ChildrenList
                      argumentId={argumentId}
                      parentDepth={threadAncestors.length}
                      parentSchemeId={argument?.schemeId}
                      parentVariableValues={(argument?.variables ?? []).map((v) => ({
                        variableId: v.variableId,
                        value: v.value,
                      }))}
                      onChildClick={goToArgument}
                    />
                  </section>
                )}
              </div>
            </section>
          </div>
        )}

        {argument != null && token && (
          <CounterArgumentDrawer
            parentArgument={argument}
            open={attackDrawerOpen}
            onClose={() => setAttackDrawerOpen(false)}
            onSuccess={(newId) => {
              setAttackDrawerOpen(false);
              navigate(`/arg/${newId}`);
            }}
            triggerRef={attackButtonRef}
          />
        )}
      </div>
    </div>
  );
}
