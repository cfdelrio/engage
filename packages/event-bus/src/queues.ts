import { Queue, Worker, type Processor } from 'bullmq';
import { QUEUES, type QueueName } from '@engage/core';
import { getRedis } from './redis.js';

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection: getRedis(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    );
  }
  return queues.get(name)!;
}

export function createWorker<T = unknown, R = unknown>(
  name: QueueName,
  processor: Processor<T, R>,
  concurrency = 5,
): Worker<T, R> {
  return new Worker<T, R>(name, processor, {
    connection: getRedis(),
    concurrency,
  });
}

export { QUEUES };
