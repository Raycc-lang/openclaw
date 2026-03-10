import type { Client } from "@buape/carbon";

const DISCORD_TYPING_START_TIMEOUT_MS = 2_000;
const pendingTypingStarts = new WeakMap<Client, Map<string, Promise<void>>>();

class DiscordTypingTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordTypingTimeoutError";
  }
}

function getPendingTypingStarts(client: Client): Map<string, Promise<void>> {
  let pending = pendingTypingStarts.get(client);
  if (!pending) {
    pending = new Map();
    pendingTypingStarts.set(client, pending);
  }
  return pending;
}

function resolveDiscordRestQueueDepth(client: Client): number | null {
  const queue = (((client as unknown) as { rest?: unknown }).rest as { queue?: unknown } | undefined)
    ?.queue;
  return Array.isArray(queue) ? queue.length : null;
}

function formatTypingTimeoutSuffix(params: { channelId: string; queueDepth: number | null }): string {
  const parts = [`channelId=${params.channelId}`];
  if (typeof params.queueDepth === "number") {
    parts.push(`queueDepth=${params.queueDepth}`);
  }
  return ` (${parts.join(" ")})`;
}

export async function sendTyping(params: {
  client: Client;
  channelId: string;
  timeoutMs?: number;
  log?: (message: string) => void;
}) {
  const pending = getPendingTypingStarts(params.client);
  if (pending.has(params.channelId)) {
    return;
  }

  const timeoutMs = params.timeoutMs ?? DISCORD_TYPING_START_TIMEOUT_MS;
  const queueDepth = resolveDiscordRestQueueDepth(params.client);
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const typingPromise = (async () => {
    const channel = await params.client.fetchChannel(params.channelId);
    if (timedOut || !channel) {
      return;
    }
    if ("triggerTyping" in channel && typeof channel.triggerTyping === "function") {
      await channel.triggerTyping();
    }
  })().catch((error) => {
    if (timedOut) {
      return;
    }
    throw error;
  });

  const timeoutPromise = new Promise<void>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      const suffix = formatTypingTimeoutSuffix({ channelId: params.channelId, queueDepth });
      const message = `discord typing start timed out after ${timeoutMs}ms${suffix}`;
      params.log?.(message);
      reject(new DiscordTypingTimeoutError(message));
    }, timeoutMs);
    timeoutHandle.unref?.();
  });

  const backgroundPromise = typingPromise.finally(() => {
    if (pending.get(params.channelId) === backgroundPromise) {
      pending.delete(params.channelId);
    }
  });
  pending.set(params.channelId, backgroundPromise);

  try {
    await Promise.race([backgroundPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
