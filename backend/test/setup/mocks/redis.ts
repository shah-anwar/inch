import { jest } from "@jest/globals";

type Fn = jest.Mock;

export interface MockRedis {
  get: Fn;
  set: Fn;
  setex: Fn;
  del: Fn;
  expire: Fn;
  exists: Fn;
  keys: Fn;
  incr: Fn;
  decr: Fn;
  publish: Fn;
  subscribe: Fn;
  unsubscribe: Fn;
  on: Fn;
  off: Fn;
  quit: Fn;
  disconnect: Fn;
  duplicate: Fn;
  ping: Fn;
  hset: Fn;
  hget: Fn;
  hgetall: Fn;
  hdel: Fn;
  sadd: Fn;
  smembers: Fn;
  srem: Fn;
}

export function buildRedisMock(): MockRedis {
  const mock: MockRedis = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => "OK"),
    setex: jest.fn(async () => "OK"),
    del: jest.fn(async () => 1),
    expire: jest.fn(async () => 1),
    exists: jest.fn(async () => 0),
    keys: jest.fn(async () => []),
    incr: jest.fn(async () => 1),
    decr: jest.fn(async () => 0),
    publish: jest.fn(async () => 0),
    subscribe: jest.fn(async () => undefined),
    unsubscribe: jest.fn(async () => undefined),
    on: jest.fn(() => mock),
    off: jest.fn(() => mock),
    quit: jest.fn(async () => "OK"),
    disconnect: jest.fn(),
    duplicate: jest.fn(() => buildRedisMock()),
    ping: jest.fn(async () => "PONG"),
    hset: jest.fn(async () => 1),
    hget: jest.fn(async () => null),
    hgetall: jest.fn(async () => ({})),
    hdel: jest.fn(async () => 1),
    sadd: jest.fn(async () => 1),
    smembers: jest.fn(async () => []),
    srem: jest.fn(async () => 1),
  };
  return mock;
}
