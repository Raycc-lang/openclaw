import { createRunStateMachine } from "../../channels/run-state-machine.js";
import { danger, logVerbose, shouldLogVerbose } from "../../globals.js";
import { formatDurationSeconds } from "../../infra/format-time/format-duration.ts";
import { KeyedAsyncQueue } from "../../plugin-sdk/keyed-async-queue.js";
import { materializeDiscordInboundJob, type DiscordInboundJob } from "./inbound-job.js";
import type { RuntimeEnv } from "./message-handler.preflight.types.js";
import { processDiscordMessageSerializedPhase } from "./message-handler.process.js";
import type { DiscordMonitorStatusSink } from "./status.js";
import { normalizeDiscordInboundWorkerTimeoutMs, runDiscordTaskWithTimeout } from "./timeouts.js";

type DiscordInboundWorkerParams = {
  runtime: RuntimeEnv;
  setStatus?: DiscordMonitorStatusSink;
  abortSignal?: AbortSignal;
  runTimeoutMs?: number;
};

export type DiscordInboundWorker = {
  enqueue: (job: DiscordInboundJob) => void;
  deactivate: () => void;
};

type QueuedDiscordJobState = {
  key: string;
  messageId: string | null;
  enqueuedAt: number;
};

function formatDiscordRunContextSuffix(job: DiscordInboundJob): string {
  const channelId = job.payload.messageChannelId?.trim();
  const messageId = job.payload.data?.message?.id?.trim();
  const details = [
    channelId ? `channelId=${channelId}` : null,
    messageId ? `messageId=${messageId}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  if (details.length === 0) {
    return "";
  }
  return ` (${details.join(", ")})`;
}

async function processDiscordInboundJob(params: {
  job: DiscordInboundJob;
  runtime: RuntimeEnv;
  lifecycleSignal?: AbortSignal;
  runTimeoutMs?: number;
}) {
  const timeoutMs = normalizeDiscordInboundWorkerTimeoutMs(params.runTimeoutMs);
  const contextSuffix = formatDiscordRunContextSuffix(params.job);
  await runDiscordTaskWithTimeout({
    run: async (abortSignal) => {
      await processDiscordMessageSerializedPhase(
        materializeDiscordInboundJob(params.job, abortSignal),
      );
    },
    timeoutMs,
    abortSignals: [params.job.runtime.abortSignal, params.lifecycleSignal],
    onTimeout: (resolvedTimeoutMs) => {
      params.runtime.error?.(
        danger(
          `discord inbound worker timed out after ${formatDurationSeconds(resolvedTimeoutMs, {
            decimals: 1,
            unit: "seconds",
          })}${contextSuffix}`,
        ),
      );
    },
    onErrorAfterTimeout: (error) => {
      params.runtime.error?.(
        danger(`discord inbound worker failed after timeout: ${String(error)}${contextSuffix}`),
      );
    },
  });
}

export function createDiscordInboundWorker(
  params: DiscordInboundWorkerParams,
): DiscordInboundWorker {
  const runQueue = new KeyedAsyncQueue();
  const runState = createRunStateMachine({
    setStatus: params.setStatus,
    abortSignal: params.abortSignal,
  });
  const queuedJobs = new Map<string, QueuedDiscordJobState[]>();
  const activeJobs = new Map<string, { messageId: string | null }>();
  let lastQueueWaitMs: number | null = null;

  const publishQueueStatus = () => {
    if (!params.setStatus) {
      return;
    }
    let queuedRuns = 0;
    for (const entries of queuedJobs.values()) {
      queuedRuns += entries.length;
    }
    const activeEntry = activeJobs.entries().next().value as
      | [string, { messageId: string | null }]
      | undefined;
    params.setStatus({
      queuedRuns,
      currentQueueKey: activeEntry?.[0] ?? null,
      currentMessageId: activeEntry?.[1].messageId ?? null,
      lastQueueWaitMs,
    });
  };

  const enqueueState = (job: DiscordInboundJob): QueuedDiscordJobState => {
    const messageId = job.payload.data?.message?.id?.trim() || null;
    const entry: QueuedDiscordJobState = {
      key: job.queueKey,
      messageId,
      enqueuedAt: Date.now(),
    };
    const existing = queuedJobs.get(job.queueKey);
    if (existing) {
      existing.push(entry);
    } else {
      queuedJobs.set(job.queueKey, [entry]);
    }
    publishQueueStatus();
    if (shouldLogVerbose()) {
      const depth = queuedJobs.get(job.queueKey)?.length ?? 0;
      logVerbose(
        `discord inbound queued: key=${job.queueKey} depth=${depth} messageId=${messageId ?? "unknown"}`,
      );
    }
    return entry;
  };

  const startState = (entry: QueuedDiscordJobState) => {
    const keyQueue = queuedJobs.get(entry.key);
    if (keyQueue) {
      const nextIndex = keyQueue.indexOf(entry);
      if (nextIndex >= 0) {
        keyQueue.splice(nextIndex, 1);
      }
      if (keyQueue.length === 0) {
        queuedJobs.delete(entry.key);
      }
    }
    const waitMs = Math.max(0, Date.now() - entry.enqueuedAt);
    lastQueueWaitMs = waitMs;
    activeJobs.set(entry.key, { messageId: entry.messageId });
    publishQueueStatus();
    if (shouldLogVerbose()) {
      logVerbose(
        `discord inbound start: key=${entry.key} waitMs=${waitMs} messageId=${entry.messageId ?? "unknown"}`,
      );
    }
  };

  const dropQueuedState = (entry: QueuedDiscordJobState) => {
    const keyQueue = queuedJobs.get(entry.key);
    if (keyQueue) {
      const nextIndex = keyQueue.indexOf(entry);
      if (nextIndex >= 0) {
        keyQueue.splice(nextIndex, 1);
      }
      if (keyQueue.length === 0) {
        queuedJobs.delete(entry.key);
      }
    }
    publishQueueStatus();
  };

  const endState = (entry: QueuedDiscordJobState) => {
    activeJobs.delete(entry.key);
    publishQueueStatus();
  };

  return {
    enqueue(job) {
      const queueEntry = enqueueState(job);
      void runQueue
        .enqueue(job.queueKey, async () => {
          if (!runState.isActive()) {
            dropQueuedState(queueEntry);
            return;
          }
          startState(queueEntry);
          runState.onRunStart();
          try {
            if (!runState.isActive()) {
              return;
            }
            await processDiscordInboundJob({
              job,
              runtime: params.runtime,
              lifecycleSignal: params.abortSignal,
              runTimeoutMs: params.runTimeoutMs,
            });
          } finally {
            if (shouldLogVerbose()) {
              logVerbose(
                `discord inbound queued phase complete: key=${queueEntry.key} messageId=${queueEntry.messageId ?? "unknown"}`,
              );
            }
            endState(queueEntry);
            runState.onRunEnd();
          }
        })
        .catch((error) => {
          params.runtime.error?.(danger(`discord inbound worker failed: ${String(error)}`));
        });
    },
    deactivate: runState.deactivate,
  };
}
