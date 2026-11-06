import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { buildFastifyMock } from "./setup/mocks/fastify.js";
import type { MockFastifyInstance } from "./setup/mocks/fastify.js";

let app: MockFastifyInstance;
let prismaDisconnect: jest.Mock;
let corsPlugin: jest.Mock;
let userRoutes: jest.Mock;
let topicRoutes: jest.Mock;
let argumentRoutes: jest.Mock;
let searchRoutes: jest.Mock;
let adminRoutes: jest.Mock;
let registerWebSocketPlugin: jest.Mock;
let startEvaluationWorker: jest.Mock;
let fastifyFactory: jest.Mock;

function registerServerMocks(): void {
  prismaDisconnect = jest.fn();
  corsPlugin = jest.fn(async () => undefined);
  userRoutes = jest.fn(async () => undefined);
  topicRoutes = jest.fn(async () => undefined);
  argumentRoutes = jest.fn(async () => undefined);
  searchRoutes = jest.fn(async () => undefined);
  adminRoutes = jest.fn(async () => undefined);
  registerWebSocketPlugin = jest.fn(async () => undefined);
  startEvaluationWorker = jest.fn(() => ({
    close: jest.fn(async () => undefined),
  }));
  fastifyFactory = jest.fn(() => {
    app = buildFastifyMock();
    return app;
  });

  jest.unstable_mockModule("dotenv/config", () => ({}));
  jest.unstable_mockModule("@db/prisma.js", () => ({
    prisma: { $disconnect: prismaDisconnect },
  }));
  jest.unstable_mockModule("@fastify/cors", () => ({
    default: corsPlugin,
  }));
  jest.unstable_mockModule("fastify", () => ({
    default: fastifyFactory,
  }));
  jest.unstable_mockModule("../src/modules/user/user.routes.js", () => ({
    default: userRoutes,
  }));
  jest.unstable_mockModule("../src/modules/topic/topic.routes.js", () => ({
    topicRoutes,
  }));
  jest.unstable_mockModule("../src/modules/argumentation/argument.routes.js", () => ({
    argumentRoutes,
  }));
  jest.unstable_mockModule("../src/modules/search/search.routes.js", () => ({
    searchRoutes,
  }));
  jest.unstable_mockModule("../src/modules/admin/admin.routes.js", () => ({
    adminRoutes,
  }));
  jest.unstable_mockModule("../src/queue/evaluationWorker.js", () => ({
    startEvaluationWorker,
  }));
  jest.unstable_mockModule("../src/websocket/ws.js", () => ({
    registerWebSocketPlugin,
  }));
}

async function flushStartup(): Promise<void> {
  await new Promise<void>((r) => setImmediate(r));
  await new Promise<void>((r) => setImmediate(r));
}

describe("server entrypoint", () => {
  const originalJwt = process.env.JWT_SECRET;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.resetModules();
    registerServerMocks();
    process.env.JWT_SECRET = "test-jwt-secret";
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.removeAllListeners("SIGINT");
    consoleLogSpy.mockRestore();
    exitSpy.mockRestore();
    if (originalJwt === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwt;
    }
  });

  it("builds the app, registers plugins, listens, and logs the address", async () => {
    await import("../src/server.js");
    await flushStartup();

    expect(fastifyFactory).toHaveBeenCalledTimes(1);
    expect(fastifyFactory).toHaveBeenCalledWith({ logger: true });

    expect(app.register).toHaveBeenCalled();
    const registerCalls = (app.register as jest.Mock).mock.calls;
    expect(registerCalls.some((c) => c[0] === corsPlugin)).toBe(true);
    expect(registerCalls.some((c) => c[0] === userRoutes)).toBe(true);
    expect(registerCalls.some((c) => c[0] === topicRoutes)).toBe(true);
    expect(registerCalls.some((c) => c[0] === argumentRoutes)).toBe(true);
    expect(registerCalls.some((c) => c[0] === searchRoutes)).toBe(true);
    expect(registerCalls.some((c) => c[0] === adminRoutes && c[1]?.prefix === "/admin")).toBe(true);

    expect(registerWebSocketPlugin).toHaveBeenCalledWith(app);
    expect(startEvaluationWorker).toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith({ port: 3000 });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/inch backend listening at/));
  });

  it("warns when JWT_SECRET is not set", async () => {
    delete process.env.JWT_SECRET;
    await import("../src/server.js");
    await flushStartup();

    expect(app.log.warn).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET is not set"));
  });

  it("warns when the evaluation worker fails to start (Error)", async () => {
    startEvaluationWorker.mockImplementation(() => {
      throw new Error("redis missing");
    });
    await import("../src/server.js");
    await flushStartup();

    expect(app.log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Evaluation worker not started: redis missing/),
    );
  });

  it("warns when the evaluation worker fails to start (non-Error)", async () => {
    startEvaluationWorker.mockImplementation(() => {
      throw "weird";
    });
    await import("../src/server.js");
    await flushStartup();

    expect(app.log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Evaluation worker not started: weird/),
    );
  });

  it("on SIGINT closes the worker and disconnects prisma when the worker started", async () => {
    const close = jest.fn(async () => undefined);
    startEvaluationWorker.mockImplementation(() => ({ close }));

    await import("../src/server.js");
    await flushStartup();

    process.emit("SIGINT" as NodeJS.Signals);
    await flushStartup();

    expect(close).toHaveBeenCalled();
    expect(prismaDisconnect).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("on SIGINT skips worker close when the worker did not start", async () => {
    startEvaluationWorker.mockImplementation(() => {
      throw new Error("no worker");
    });

    await import("../src/server.js");
    await flushStartup();

    process.emit("SIGINT" as NodeJS.Signals);
    await flushStartup();

    expect(prismaDisconnect).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
