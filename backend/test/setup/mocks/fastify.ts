import { jest } from "@jest/globals";

type Fn = jest.Mock;

export interface MockReply {
  code: Fn;
  status: Fn;
  send: Fn;
  header: Fn;
  type: Fn;
  redirect: Fn;
  statusCode: number;
  payload?: unknown;
  sentHeaders: Record<string, string>;
}

export function buildReplyMock(): MockReply {
  const reply: MockReply = {
    statusCode: 200,
    sentHeaders: {},
    code: jest.fn(),
    status: jest.fn(),
    send: jest.fn(),
    header: jest.fn(),
    type: jest.fn(),
    redirect: jest.fn(),
  };
  reply.code.mockImplementation((c: number) => {
    reply.statusCode = c;
    return reply;
  });
  reply.status.mockImplementation((c: number) => {
    reply.statusCode = c;
    return reply;
  });
  reply.send.mockImplementation(async (p: unknown) => {
    reply.payload = p;
    return reply;
  });
  reply.header.mockImplementation((k: string, v: string) => {
    reply.sentHeaders[k] = v;
    return reply;
  });
  reply.type.mockImplementation(() => reply);
  reply.redirect.mockImplementation(() => reply);
  return reply;
}

export interface MockRequestOpts {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  userId?: number;
}

export interface MockRequest {
  headers: Record<string, string>;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
  userId?: number;
  log: { info: Fn; warn: Fn; error: Fn; debug: Fn };
}

export function buildRequestMock(opts: MockRequestOpts = {}): MockRequest {
  return {
    headers: opts.headers ?? {},
    params: opts.params ?? {},
    query: opts.query ?? {},
    body: opts.body,
    userId: opts.userId,
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
}

export interface MockFastifyInstance {
  get: Fn;
  post: Fn;
  put: Fn;
  patch: Fn;
  delete: Fn;
  head: Fn;
  options: Fn;
  all: Fn;
  register: Fn;
  addHook: Fn;
  decorate: Fn;
  decorateRequest: Fn;
  listen: Fn;
  close: Fn;
  ready: Fn;
  setErrorHandler: Fn;
  log: { info: Fn; warn: Fn; error: Fn; debug: Fn };
  routes: Record<
    string,
    Record<
      string,
      {
        handler: (req: unknown, reply: unknown) => unknown;
        opts: Record<string, unknown>;
      }
    >
  >;
}

function recordRoute(
  fastify: MockFastifyInstance,
  method: string,
  url: string,
  optsOrHandler: unknown,
  handlerArg?: unknown,
) {
  let opts: Record<string, unknown> = {};
  let handler: (req: unknown, reply: unknown) => unknown;
  if (typeof optsOrHandler === "function") {
    handler = optsOrHandler as (req: unknown, reply: unknown) => unknown;
  } else {
    opts = (optsOrHandler as Record<string, unknown>) ?? {};
    handler = handlerArg as (req: unknown, reply: unknown) => unknown;
  }
  fastify.routes[method] ??= {};
  fastify.routes[method][url] = { handler, opts };
}

export function buildFastifyMock(): MockFastifyInstance {
  const fastify: MockFastifyInstance = {
    routes: {},
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    head: jest.fn(),
    options: jest.fn(),
    all: jest.fn(),
    register: jest.fn(async (plugin: unknown, opts?: unknown) => {
      if (typeof plugin === "function") {
        await (plugin as (f: MockFastifyInstance, o: unknown) => Promise<void>)(fastify, opts);
      }
      return fastify;
    }),
    addHook: jest.fn(),
    decorate: jest.fn(),
    decorateRequest: jest.fn(),
    listen: jest.fn(async () => "http://localhost:0"),
    close: jest.fn(async () => undefined),
    ready: jest.fn(async () => undefined),
    setErrorHandler: jest.fn(),
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
  fastify.get.mockImplementation((url: string, a: unknown, b?: unknown) => {
    recordRoute(fastify, "GET", url, a, b);
    return fastify;
  });
  fastify.post.mockImplementation((url: string, a: unknown, b?: unknown) => {
    recordRoute(fastify, "POST", url, a, b);
    return fastify;
  });
  fastify.put.mockImplementation((url: string, a: unknown, b?: unknown) => {
    recordRoute(fastify, "PUT", url, a, b);
    return fastify;
  });
  fastify.patch.mockImplementation((url: string, a: unknown, b?: unknown) => {
    recordRoute(fastify, "PATCH", url, a, b);
    return fastify;
  });
  fastify.delete.mockImplementation((url: string, a: unknown, b?: unknown) => {
    recordRoute(fastify, "DELETE", url, a, b);
    return fastify;
  });
  fastify.head.mockImplementation((url: string, a: unknown, b?: unknown) => {
    recordRoute(fastify, "HEAD", url, a, b);
    return fastify;
  });
  fastify.options.mockImplementation((url: string, a: unknown, b?: unknown) => {
    recordRoute(fastify, "OPTIONS", url, a, b);
    return fastify;
  });
  return fastify;
}

export function getRouteHandler(
  fastify: MockFastifyInstance,
  method: string,
  url: string,
): (req: unknown, reply: unknown) => unknown {
  const route = fastify.routes[method]?.[url];
  if (!route) {
    throw new Error(`Route not registered: ${method} ${url}`);
  }
  return route.handler;
}
