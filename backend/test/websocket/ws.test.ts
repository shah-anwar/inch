import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import { buildFastifyMock, buildRequestMock, getRouteHandler } from "../setup/mocks/fastify.js";
import type { MockFastifyInstance } from "../setup/mocks/fastify.js";

const fastifyWebsocketPlugin = jest.fn(async (_app: MockFastifyInstance) => undefined);

jest.unstable_mockModule("@fastify/websocket", () => ({
  default: fastifyWebsocketPlugin,
  fastifyWebsocket: fastifyWebsocketPlugin,
}));

type WsModule = typeof import("../../src/websocket/ws.js");

let ws: WsModule;

beforeAll(async () => {
  ws = await import("../../src/websocket/ws.js");
});

function attachAsyncRegister(app: MockFastifyInstance): void {
  app.register.mockImplementation(async (plugin: unknown, opts?: unknown) => {
    const resolved = await Promise.resolve(plugin);
    const pluginFn =
      typeof resolved === "function"
        ? (resolved as (f: MockFastifyInstance, o: unknown) => Promise<void>)
        : resolved && typeof (resolved as { default?: unknown }).default === "function"
          ? (
              resolved as {
                default: (f: MockFastifyInstance, o: unknown) => Promise<void>;
              }
            ).default
          : undefined;
    if (pluginFn) await pluginFn(app, opts);
    return app;
  });
}

type FakeSocket = {
  OPEN: number;
  readyState: number;
  send: jest.Mock;
  on: jest.Mock;
  close: jest.Mock;
  trigger: (event: string, ...args: unknown[]) => void;
};

function buildFakeSocket(readyState = 1): FakeSocket {
  const OPEN = 1;
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const socket: FakeSocket = {
    OPEN,
    readyState,
    send: jest.fn(),
    on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
      return socket;
    }),
    close: jest.fn(),
    trigger(event: string, ...args: unknown[]) {
      for (const fn of listeners.get(event) ?? []) {
        fn(...args);
      }
    },
  };
  return socket;
}

describe("src/websocket/ws", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length) {
      cleanups.pop()?.();
    }
    fastifyWebsocketPlugin.mockClear();
  });

  describe("getSubtopicRoom", () => {
    it("returns a stable subtopic-scoped room id", () => {
      expect(ws.getSubtopicRoom(42)).toBe("subtopic:42");
    });
  });

  describe("joinRoom", () => {
    it("creates a room on first join and reuses the set", () => {
      const a = buildFakeSocket();
      const b = buildFakeSocket();
      const room = "subtopic:1";
      ws.joinRoom(room, a as never);
      ws.joinRoom(room, b as never);
      cleanups.push(() => {
        ws.leaveRoom(room, a as never);
        ws.leaveRoom(room, b as never);
      });
      ws.emitToRoom(room, "PING", {});
      expect(a.send).toHaveBeenCalled();
      expect(b.send).toHaveBeenCalled();
    });
  });

  describe("leaveRoom", () => {
    it("is a no-op when the room does not exist", () => {
      const s = buildFakeSocket();
      expect(() => ws.leaveRoom("missing-room", s as never)).not.toThrow();
    });

    it("removes the socket and deletes empty rooms", () => {
      const room = "subtopic:99";
      const s = buildFakeSocket();
      ws.joinRoom(room, s as never);
      ws.leaveRoom(room, s as never);
      ws.emitToRoom(room, "X", {});
      expect(s.send).not.toHaveBeenCalled();
    });

    it("keeps the room when other sockets remain", () => {
      const room = "subtopic:100";
      const a = buildFakeSocket();
      const b = buildFakeSocket();
      ws.joinRoom(room, a as never);
      ws.joinRoom(room, b as never);
      ws.leaveRoom(room, a as never);
      cleanups.push(() => ws.leaveRoom(room, b as never));
      ws.emitToRoom(room, "X", {});
      expect(a.send).not.toHaveBeenCalled();
      expect(b.send).toHaveBeenCalled();
    });
  });

  describe("emitToRoom", () => {
    it("returns early when the room is missing or has no clients", () => {
      const s = buildFakeSocket();
      ws.emitToRoom("ghost-room", "E", {});
      expect(s.send).not.toHaveBeenCalled();
    });

    it("skips sockets that are not OPEN", () => {
      const room = "subtopic:2";
      const openSock = buildFakeSocket(1);
      const closedSock = buildFakeSocket(3);
      ws.joinRoom(room, openSock as never);
      ws.joinRoom(room, closedSock as never);
      cleanups.push(() => {
        ws.leaveRoom(room, openSock as never);
        ws.leaveRoom(room, closedSock as never);
      });
      ws.emitToRoom(room, "EVT", { n: 1 });
      expect(openSock.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "EVT", payload: { n: 1 } }),
      );
      expect(closedSock.send).not.toHaveBeenCalled();
    });
  });

  describe("registerWebSocketPlugin", () => {
    let app: MockFastifyInstance;

    beforeEach(() => {
      app = buildFastifyMock();
      attachAsyncRegister(app);
    });

    it("registers @fastify/websocket and the /ws websocket route", async () => {
      await ws.registerWebSocketPlugin(app as never);

      expect(app.register).toHaveBeenCalled();
      const registered = app.register.mock.calls[0][0] as Promise<unknown>;
      // `import()` can yield a Promise from a different realm than `global.Promise` under VM modules.
      const resolvedModule = await Promise.resolve(registered);
      expect(resolvedModule).toEqual(
        expect.objectContaining({
          default: fastifyWebsocketPlugin,
          fastifyWebsocket: fastifyWebsocketPlugin,
        }),
      );
      expect(fastifyWebsocketPlugin).toHaveBeenCalledWith(app, undefined);

      expect(app.get).toHaveBeenCalledWith("/ws", { websocket: true }, expect.any(Function));
    });

    function getWsHandler(): (
      socket: FakeSocket,
      request: ReturnType<typeof buildRequestMock>,
    ) => void {
      return getRouteHandler(app, "GET", "/ws") as never;
    }

    it("closes the socket when subtopicId is missing, zero, or not a number", async () => {
      await ws.registerWebSocketPlugin(app as never);
      const handler = getWsHandler();

      const cases: Array<Record<string, string> | Record<string, never>> = [
        {},
        { subtopicId: "0" },
        { subtopicId: "nan" },
      ];

      for (const query of cases) {
        const socket = buildFakeSocket();
        const request = buildRequestMock({ query }) as ReturnType<typeof buildRequestMock>;
        handler(socket, request);
        expect(socket.close).toHaveBeenCalledWith(1008, "subtopicId query parameter required");
        expect(socket.on).not.toHaveBeenCalled();
      }
    });

    it("joins the room, confirms JOINED, and leaves on close", async () => {
      await ws.registerWebSocketPlugin(app as never);
      const handler = getWsHandler();
      const socket = buildFakeSocket();
      const subtopicId = 7;
      const request = buildRequestMock({
        query: { subtopicId: String(subtopicId) },
      }) as ReturnType<typeof buildRequestMock>;

      handler(socket, request);

      expect(socket.close).not.toHaveBeenCalled();
      expect(socket.on).toHaveBeenCalledWith("close", expect.any(Function));

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: "JOINED",
          payload: {
            subtopicId,
            roomId: ws.getSubtopicRoom(subtopicId),
          },
        }),
      );

      socket.send.mockClear();
      const roomId = ws.getSubtopicRoom(subtopicId);
      ws.emitToRoom(roomId, "X", { ok: true });
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "X", payload: { ok: true } }),
      );

      socket.trigger("close");
      socket.send.mockClear();
      ws.emitToRoom(roomId, "Y", {});
      expect(socket.send).not.toHaveBeenCalled();
    });
  });
});
