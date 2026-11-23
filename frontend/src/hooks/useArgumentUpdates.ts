import { ArgumentCreatedPayloadSchema, StatusUpdatePayloadSchema } from "@inch/types";
import { useEffect, useRef, useCallback } from "react";

interface UseArgumentUpdatesOptions {
  subtopicId: number | null;
  onStatusUpdate: (updates: { id: string; status: string }[]) => void;
  onArgumentCreated?: (payload: {
    subtopicId: number;
    argumentId: string;
    parentId: string | null;
  }) => void;
}

/**
 * Subscribes to subtopic-scoped status updates over WebSocket and forwards
 * validated payloads to the caller.
 *
 * Side effects:
 * - Opens a WebSocket connection.
 * - Automatically retries on disconnect with a fixed delay.
 * - Cleans up timers and sockets on unmount.
 *
 * The status callback is read from a ref so the socket is not torn down on every
 * parent re-render (which would refetch constantly and fight browser history).
 *
 * @param options Hook options containing subtopic scope and update callback.
 * @returns Nothing; the hook coordinates side effects only.
 */
export function useArgumentUpdates({
  subtopicId,
  onStatusUpdate,
  onArgumentCreated,
}: UseArgumentUpdatesOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStatusUpdateRef = useRef(onStatusUpdate);
  onStatusUpdateRef.current = onStatusUpdate;
  const onArgumentCreatedRef = useRef(onArgumentCreated);
  onArgumentCreatedRef.current = onArgumentCreated;

  const connect = useCallback(() => {
    if (!subtopicId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
    const wsUrl = apiUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/ws?subtopicId=${subtopicId}`);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        if (message.event === "STATUS_UPDATE") {
          const result = StatusUpdatePayloadSchema.safeParse(message.payload);
          if (result.success) {
            onStatusUpdateRef.current(result.data.updates);
          }
        } else if (message.event === "ARGUMENT_CREATED") {
          const result = ArgumentCreatedPayloadSchema.safeParse(message.payload);
          if (result.success) {
            onArgumentCreatedRef.current?.(result.data);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [subtopicId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);
}
