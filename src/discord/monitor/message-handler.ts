import type { Client } from "@buape/carbon";
import {
  createChannelInboundDebouncer,
  shouldDebounceTextInbound,
} from "../../channels/inbound-debounce-policy.js";
import { resolveOpenProviderRuntimeGroupPolicy } from "../../config/runtime-group-policy.js";
import { danger, logVerbose, shouldLogVerbose } from "../../globals.js";
import { formatDurationSeconds } from "../../infra/format-time/format-duration.ts";
import { buildDiscordInboundJob } from "./inbound-job.js";
import { createDiscordInboundWorker } from "./inbound-worker.js";
import type { DiscordMessageEvent, DiscordMessageHandler } from "./listeners.js";
import { preflightDiscordMessage } from "./message-handler.preflight.js";
import type { DiscordMessagePreflightParams } from "./message-handler.preflight.types.js";
import {
  hasDiscordMessageStickers,
  resolveDiscordMessageChannelId,
  resolveDiscordMessageText,
} from "./message-utils.js";
import type { DiscordMonitorStatusSink } from "./status.js";

type DiscordMessageHandlerParams = Omit<
  DiscordMessagePreflightParams,
  "ackReactionScope" | "groupPolicy" | "data" | "client"
> & {
  setStatus?: DiscordMonitorStatusSink;
  abortSignal?: AbortSignal;
  workerRunTimeoutMs?: number;
};

export type DiscordMessageHandlerWithLifecycle = DiscordMessageHandler & {
  deactivate: () => void;
};

const DISCORD_SLOW_PRE_ENQUEUE_STAGE_MS = 30_000;

function formatDiscordPreEnqueueContext(entry: {
  data: DiscordMessageEvent;
  messageChannelId?: string | null;
}) {
  return {
    channelId: entry.messageChannelId ?? entry.data.channel_id,
    messageId: entry.data.message?.id,
    guildId: entry.data.guild_id,
  };
}

function formatDiscordPreEnqueueContextSuffix(context: Record<string, unknown>) {
  const parts = Object.entries(context)
    .map(([key, value]) => {
      const normalized =
        typeof value === "string"
          ? value.trim()
          : typeof value === "number" || typeof value === "bigint"
            ? String(value)
            : null;
      return normalized ? `${key}=${normalized}` : null;
    })
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? ` (${parts.join(" ")})` : "";
}

function logDiscordPreEnqueueTiming(params: {
  runtime: DiscordMessageHandlerParams["runtime"];
  stage: string;
  durationMs: number;
  context: Record<string, unknown>;
}) {
  const durationLabel = formatDurationSeconds(params.durationMs, {
    decimals: 1,
    unit: "seconds",
  });
  const suffix = formatDiscordPreEnqueueContextSuffix(params.context);
  if (shouldLogVerbose()) {
    logVerbose(`discord pre-enqueue ${params.stage}: ${durationLabel}${suffix}`);
  }
  if (params.durationMs >= DISCORD_SLOW_PRE_ENQUEUE_STAGE_MS) {
    params.runtime.log?.(`discord slow pre-enqueue ${params.stage}: ${durationLabel}${suffix}`);
  }
}

export function createDiscordMessageHandler(
  params: DiscordMessageHandlerParams,
): DiscordMessageHandlerWithLifecycle {
  const { groupPolicy } = resolveOpenProviderRuntimeGroupPolicy({
    providerConfigPresent: params.cfg.channels?.discord !== undefined,
    groupPolicy: params.discordConfig?.groupPolicy,
    defaultGroupPolicy: params.cfg.channels?.defaults?.groupPolicy,
  });
  const ackReactionScope =
    params.discordConfig?.ackReactionScope ??
    params.cfg.messages?.ackReactionScope ??
    "group-mentions";
  const inboundWorker = createDiscordInboundWorker({
    runtime: params.runtime,
    setStatus: params.setStatus,
    abortSignal: params.abortSignal,
    runTimeoutMs: params.workerRunTimeoutMs,
  });

  const { debouncer } = createChannelInboundDebouncer<{
    data: DiscordMessageEvent;
    client: Client;
    abortSignal?: AbortSignal;
  }>({
    cfg: params.cfg,
    channel: "discord",
    buildKey: (entry) => {
      const message = entry.data.message;
      const authorId = entry.data.author?.id;
      if (!message || !authorId) {
        return null;
      }
      const channelId = resolveDiscordMessageChannelId({
        message,
        eventChannelId: entry.data.channel_id,
      });
      if (!channelId) {
        return null;
      }
      return `discord:${params.accountId}:${channelId}:${authorId}`;
    },
    shouldDebounce: (entry) => {
      const message = entry.data.message;
      if (!message) {
        return false;
      }
      const baseText = resolveDiscordMessageText(message, { includeForwarded: false });
      return shouldDebounceTextInbound({
        text: baseText,
        cfg: params.cfg,
        hasMedia: Boolean(
          (message.attachments && message.attachments.length > 0) ||
          hasDiscordMessageStickers(message),
        ),
      });
    },
    onFlush: async (entries) => {
      const flushStartedAt = Date.now();
      const last = entries.at(-1);
      if (!last) {
        return;
      }
      const abortSignal = last.abortSignal;
      if (abortSignal?.aborted) {
        return;
      }
      if (entries.length === 1) {
        const preflightStartedAt = Date.now();
        const ctx = await preflightDiscordMessage({
          ...params,
          ackReactionScope,
          groupPolicy,
          abortSignal,
          data: last.data,
          client: last.client,
        });
        const preflightContext = formatDiscordPreEnqueueContext({
          data: last.data,
          messageChannelId: ctx?.messageChannelId,
        });
        logDiscordPreEnqueueTiming({
          runtime: params.runtime,
          stage: "preflight",
          durationMs: Date.now() - preflightStartedAt,
          context: preflightContext,
        });
        if (!ctx) {
          return;
        }
        inboundWorker.enqueue(buildDiscordInboundJob(ctx));
        logDiscordPreEnqueueTiming({
          runtime: params.runtime,
          stage: "flush",
          durationMs: Date.now() - flushStartedAt,
          context: preflightContext,
        });
        return;
      }
      const combinedBaseText = entries
        .map((entry) => resolveDiscordMessageText(entry.data.message, { includeForwarded: false }))
        .filter(Boolean)
        .join("\n");
      const syntheticMessage = {
        ...last.data.message,
        content: combinedBaseText,
        attachments: [],
        message_snapshots: (last.data.message as { message_snapshots?: unknown }).message_snapshots,
        messageSnapshots: (last.data.message as { messageSnapshots?: unknown }).messageSnapshots,
        rawData: {
          ...(last.data.message as { rawData?: Record<string, unknown> }).rawData,
        },
      };
      const syntheticData: DiscordMessageEvent = {
        ...last.data,
        message: syntheticMessage,
      };
      const preflightStartedAt = Date.now();
      const ctx = await preflightDiscordMessage({
        ...params,
        ackReactionScope,
        groupPolicy,
        abortSignal,
        data: syntheticData,
        client: last.client,
      });
      const preflightContext = formatDiscordPreEnqueueContext({
        data: syntheticData,
        messageChannelId: ctx?.messageChannelId,
      });
      logDiscordPreEnqueueTiming({
        runtime: params.runtime,
        stage: "preflight-batch",
        durationMs: Date.now() - preflightStartedAt,
        context: {
          ...preflightContext,
          messageCount: entries.length,
        },
      });
      if (!ctx) {
        return;
      }
      if (entries.length > 1) {
        const ids = entries.map((entry) => entry.data.message?.id).filter(Boolean) as string[];
        if (ids.length > 0) {
          const ctxBatch = ctx as typeof ctx & {
            MessageSids?: string[];
            MessageSidFirst?: string;
            MessageSidLast?: string;
          };
          ctxBatch.MessageSids = ids;
          ctxBatch.MessageSidFirst = ids[0];
          ctxBatch.MessageSidLast = ids[ids.length - 1];
        }
      }
      inboundWorker.enqueue(buildDiscordInboundJob(ctx));
      logDiscordPreEnqueueTiming({
        runtime: params.runtime,
        stage: "flush-batch",
        durationMs: Date.now() - flushStartedAt,
        context: {
          ...preflightContext,
          messageCount: entries.length,
        },
      });
    },
    onError: (err) => {
      params.runtime.error?.(danger(`discord debounce flush failed: ${String(err)}`));
    },
  });

  const handler: DiscordMessageHandlerWithLifecycle = async (data, client, options) => {
    try {
      const enqueueStartedAt = Date.now();
      if (options?.abortSignal?.aborted) {
        return;
      }
      // Filter bot-own messages before they enter the debounce queue.
      // The same check exists in preflightDiscordMessage(), but by that point
      // the message has already consumed debounce capacity and blocked
      // legitimate user messages. On active servers this causes cumulative
      // slowdown (see #15874).
      const msgAuthorId = data.message?.author?.id ?? data.author?.id;
      if (params.botUserId && msgAuthorId === params.botUserId) {
        return;
      }

      await debouncer.enqueue({ data, client, abortSignal: options?.abortSignal });
      logDiscordPreEnqueueTiming({
        runtime: params.runtime,
        stage: "handler-to-enqueue",
        durationMs: Date.now() - enqueueStartedAt,
        context: formatDiscordPreEnqueueContext({ data }),
      });
    } catch (err) {
      params.runtime.error?.(danger(`handler failed: ${String(err)}`));
    }
  };

  handler.deactivate = inboundWorker.deactivate;

  return handler;
}
