import { jest } from "@jest/globals";

type Fn = jest.Mock;

export interface MockQueue {
  add: Fn;
  addBulk: Fn;
  close: Fn;
  getJob: Fn;
  getJobs: Fn;
  getJobCounts: Fn;
  getWaiting: Fn;
  getActive: Fn;
  getCompleted: Fn;
  getFailed: Fn;
  remove: Fn;
  pause: Fn;
  resume: Fn;
  on: Fn;
  name: string;
}

export interface MockWorker {
  on: Fn;
  close: Fn;
  run: Fn;
  processFn?: unknown;
}

export interface MockQueueEvents {
  on: Fn;
  close: Fn;
  waitUntilReady: Fn;
}

export function buildQueueMock(name = "test-queue"): MockQueue {
  const queue: MockQueue = {
    add: jest.fn(async (jobName: string, data: unknown) => ({
      id: "job_1",
      name: jobName,
      data,
    })),
    addBulk: jest.fn(async () => []),
    close: jest.fn(async () => undefined),
    getJob: jest.fn(async () => null),
    getJobs: jest.fn(async () => []),
    getJobCounts: jest.fn(async () => ({ waiting: 0, active: 0, completed: 0, failed: 0 })),
    getWaiting: jest.fn(async () => []),
    getActive: jest.fn(async () => []),
    getCompleted: jest.fn(async () => []),
    getFailed: jest.fn(async () => []),
    remove: jest.fn(async () => 1),
    pause: jest.fn(async () => undefined),
    resume: jest.fn(async () => undefined),
    on: jest.fn(() => queue),
    name,
  };
  return queue;
}

export function buildWorkerMock(): MockWorker {
  const worker: MockWorker = {
    on: jest.fn(() => worker),
    close: jest.fn(async () => undefined),
    run: jest.fn(async () => undefined),
  };
  return worker;
}

export function buildQueueEventsMock(): MockQueueEvents {
  const qe: MockQueueEvents = {
    on: jest.fn(() => qe),
    close: jest.fn(async () => undefined),
    waitUntilReady: jest.fn(async () => undefined),
  };
  return qe;
}

export interface MockBullMqModule {
  Queue: Fn;
  Worker: Fn;
  QueueEvents: Fn;
  lastQueue?: MockQueue;
  lastWorker?: MockWorker;
  lastQueueEvents?: MockQueueEvents;
}

export function buildBullMqModuleMock(): MockBullMqModule {
  const state: MockBullMqModule = {
    Queue: jest.fn(),
    Worker: jest.fn(),
    QueueEvents: jest.fn(),
  };
  state.Queue = jest.fn((name: string) => {
    const q = buildQueueMock(name);
    state.lastQueue = q;
    return q;
  });
  state.Worker = jest.fn((_name: string, processor: unknown) => {
    const w = buildWorkerMock();
    w.processFn = processor;
    state.lastWorker = w;
    return w;
  });
  state.QueueEvents = jest.fn(() => {
    const qe = buildQueueEventsMock();
    state.lastQueueEvents = qe;
    return qe;
  });
  return state;
}
