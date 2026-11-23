import type { WebSocket } from "@fastify/websocket";
import type { FastifyInstance } from "fastify";

// Room registry: subtopicId → Set of connected WebSocket clients
const rooms = new Map<string, Set<WebSocket>>();

/** Builds the canonical websocket room id for a subtopic. */
export function getSubtopicRoom(subtopicId: number): string {
  return `subtopic:${subtopicId}`;
}

/**
 * Adds a socket to a subtopic room.
 *
 * @param roomId Room identifier.
 * @param socket Connected websocket client.
 */
export function joinRoom(roomId: string, socket: WebSocket): void {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId)!.add(socket);
}

/**
 * Removes a socket from a room and prunes empty rooms.
 *
 * @param roomId Room identifier.
 * @param socket Socket to remove.
 */
export function leaveRoom(roomId: string, socket: WebSocket): void {
  rooms.get(roomId)?.delete(socket);
  if (rooms.get(roomId)?.size === 0) {
    rooms.delete(roomId);
  }
}

/**
 * Broadcasts an event payload to all open sockets in a room.
 *
 * @param roomId Room identifier.
 * @param event Event name to send.
 * @param payload JSON-serializable payload data.
 */
export function emitToRoom(roomId: string, event: string, payload: unknown): void {
  const clients = rooms.get(roomId);
  if (!clients || clients.size === 0) return;

  const message = JSON.stringify({ event, payload });

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Registers websocket transport and `/ws` subscription endpoint.
 *
 * @param fastify Fastify instance.
 * @returns Promise resolved after plugin registration.
 */
export async function registerWebSocketPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(import("@fastify/websocket"));

  // Client connects with: ws://localhost:3000/ws?subtopicId=123
  fastify.get("/ws", { websocket: true }, (socket, request) => {
    const subtopicId = Number((request.query as Record<string, string>).subtopicId);

    if (!subtopicId || isNaN(subtopicId)) {
      socket.close(1008, "subtopicId query parameter required");
      return;
    }

    const roomId = getSubtopicRoom(subtopicId);
    joinRoom(roomId, socket);

    socket.on("close", () => {
      leaveRoom(roomId, socket);
    });

    // Send a join confirmation
    socket.send(
      JSON.stringify({
        event: "JOINED",
        payload: { subtopicId, roomId },
      }),
    );
  });
}
