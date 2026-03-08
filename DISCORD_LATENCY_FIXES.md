# Discord Latency Fixes

## Context

This fork has been chasing two separate Discord latency failure modes:

1. Post-enqueue delays where a message is accepted quickly but waits minutes before a reply starts.
2. Pre-enqueue listener timeouts where Discord handler work burns the 120 second listener budget before the inbound worker even receives the job.

## 2026-03-08 changes

These patches were already in place before the latest investigation:

### 1. Dedicated Discord inbound lane

Live Discord user messages now run on a `discord-inbound` lane instead of sharing the global `main` lane with cron, heartbeat, and CLI work.

- `src/process/lanes.ts`
- `src/gateway/server-lanes.ts`
- `src/gateway/server-reload-handlers.ts`
- `src/auto-reply/reply/get-reply-run.ts`
- `src/auto-reply/reply/queue/types.ts`
- `src/auto-reply/reply/queue/agent-runner-utils.ts`
- `src/auto-reply/reply/queue/followup-runner.ts`

### 2. Discord delivery hardening

- The outer retry layer no longer retries Carbon `RateLimitError`.
- Per-attempt success/failure logging with elapsed time was added in `src/discord/monitor/reply-delivery.ts`.

### 3. Fetch timeouts on raw Discord REST paths

- 15 second `AbortSignal.timeout` on webhook sends in `src/discord/send.outbound.ts`
- 15 second `AbortSignal.timeout` on voice upload requests in `src/discord/voice-message.ts`

## 2026-03-09 findings

The March 8 changes did not fix the latest 5 to 10 minute delay reports.

The confirmed root cause for those runs was same-session head-of-line blocking after enqueue:

- `src/discord/monitor/inbound-job.ts` resolves the worker `queueKey` from `route.sessionKey` first.
- `src/discord/monitor/inbound-worker.ts` serializes work with `KeyedAsyncQueue`.
- The old worker awaited the full `processDiscordMessage(...)` path inside that keyed queue.
- `src/discord/monitor/message-handler.process.ts` held that lock through agent dispatch, Discord reply delivery, draft cleanup, and status reaction completion.

That means one long message could monopolize a session key for minutes, and later messages in the same session would sit in queue even if they were accepted immediately.

Important nuance:

- This is not one global Discord queue.
- It is per resolved session key.
- Different Discord channels can still collide if they intentionally resolve to the same session key, such as bound-thread or shared-session cases.

There is still a separate pre-enqueue timeout path:

- `src/discord/monitor/message-handler.ts` still awaits debounce flush and preflight before `inboundWorker.enqueue(...)`.
- Carbon listener timeout remains 120 seconds by default.

That second issue still needs follow-up work.

## 2026-03-09 fix

The inbound worker now releases the serialized session key after the model run has queued replies, instead of waiting for Discord delivery and final cleanup to finish.

### What changed

- `src/discord/monitor/message-handler.process.ts`
  - Added `processDiscordMessageSerializedPhase(...)`
  - Split the Discord processing path into:
    - a serialized phase that runs session-critical work and queues replies
    - a detached settle phase that waits for Discord delivery, draft cleanup, status reactions, and history cleanup
  - Kept `processDiscordMessage(...)` as the full end-to-end variant for tests and callers that need delivery completion.

- `src/discord/monitor/inbound-worker.ts`
  - Switched the keyed worker to `processDiscordMessageSerializedPhase(...)`
  - Added queue visibility for:
    - `queuedRuns`
    - `currentQueueKey`
    - `currentMessageId`
    - `lastQueueWaitMs`
  - Added verbose logs on queue, start, and serialized-phase completion.

- `src/discord/monitor/status.ts`
  - Extended Discord monitor status fields to carry the queue metrics above.

### Why this helps

- Session ordering is still preserved for the part that actually mutates or depends on shared session state.
- Slow Discord delivery no longer holds the per-session lock.
- Later messages in the same session can start once the earlier message has finished the serialized model/dispatch phase, instead of waiting for all downstream Discord delivery bookkeeping.

## Validation

Focused regression coverage added:

- `src/discord/monitor/message-handler.queue.test.ts`
- `src/discord/monitor/message-handler.process.test.ts`
- `src/discord/monitor/message-handler.bot-self-filter.test.ts`

New regression coverage specifically proves that:

- the serialized Discord phase resolves before slow final delivery settles
- queue progress continues without waiting for Discord delivery completion

Local validation used for this fix:

```bash
pnpm vitest src/discord/monitor/message-handler.process.test.ts src/discord/monitor/message-handler.queue.test.ts src/discord/monitor/message-handler.bot-self-filter.test.ts --run
```

`pnpm check` is currently blocked by existing repository-wide formatting issues in unrelated pre-existing files outside this change set.

## 2026-03-09 follow-up instrumentation

The pre-enqueue timeout path now has first-class timing diagnostics:

- `src/discord/monitor/message-handler.ts`
  - logs preflight duration
  - logs debounce flush duration
  - logs total handler-to-enqueue duration
  - emits a visible slow-pre-enqueue log once the pre-enqueue phase crosses 30 seconds

- `src/gateway/protocol/schema/channels.ts`
- `src/channels/plugins/types.core.ts`
  - thread the new queue metrics through shared channel snapshot types so status consumers can read them

## Remaining follow-up

1. Consider whether any unbound Discord cases can safely narrow queue keys further without breaking shared-session semantics.
2. Surface queue metrics in the monitor UI or richer status views used during live incident response.
