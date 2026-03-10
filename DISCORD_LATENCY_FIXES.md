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

## 2026-03-09 pre-enqueue channel lookup fix

The remaining pre-enqueue bottleneck was verified in the channel-info path before
`inboundWorker.enqueue(...)`.

### Verified mechanism

- `src/discord/monitor/message-handler.preflight.ts`
  - still resolved channel info before enqueue
  - already logged that work as `preflight-channel-info`
- `src/discord/monitor/message-utils.ts`
  - still called `client.fetchChannel(channelId)` on cache miss
- `node_modules/@buape/carbon/dist/src/classes/RequestClient.js`
  - Carbon queues REST requests through a single per-client FIFO queue
  - queued requests are not cancelable from the OpenClaw listener timeout path

Important nuance:

- Carbon does apply a 15 second timeout once a REST request starts.
- The real stall vector is the uncancelable wait before a queued `fetchChannel(...)` request starts.

### What changed

- `src/discord/monitor/message-handler.preflight.ts`
  - added queue-depth-aware diagnostics around `preflight-channel-info`
  - uses a tight 2 second local fallback budget for guild channel-info lookup
  - continues guild preflight with degraded metadata if channel lookup is stuck
- `src/discord/monitor/message-utils.ts`
  - added a channel-info cache probe used by preflight diagnostics
- `src/discord/monitor/message-handler.preflight.test.ts`
  - added regression coverage for a stalled guild `fetchChannel(...)` path

### Why this helps

- Ordinary guild messages no longer sit in preflight indefinitely waiting on Carbon's REST queue.
- The listener can still classify guild traffic from `guild_id` and move the message into the inbound worker.
- Channel names, thread parent info, and other enrichments still work when the lookup returns quickly, but they no longer block ingress forever during incidents.

### Validation

Focused local validation for this fix:

```bash
pnpm vitest src/discord/monitor/message-handler.preflight.test.ts src/discord/monitor/message-utils.test.ts --run
```

Status:

- the focused Vitest scope passed
- full `pnpm tsgo` is still blocked by pre-existing repository-wide type errors in unrelated extension and gateway files
- filtering `pnpm tsgo` output for `message-handler.preflight` and `message-utils` produced no hits after this change

## VPS deployment

Deployed to the VPS on 2026-03-09 UTC using the `START_HERE.md` rsync workflow:

- stopped `openclaw-gateway.service`
- rsynced `/home/ray/miniAgent/_fresh-rebase/` to `/root/miniAgent/`
- ran `/root/.bun/bin/bun install`
- restarted `openclaw-gateway.service`

Post-deploy verification on the VPS:

- service restarted at `Mon 2026-03-09 10:12:02 UTC`
- current gateway PID after restart: `124142`
- gateway is listening on `127.0.0.1:18789`
- Discord provider logged in again at `2026-03-09T10:12:14.071+00:00` as `1477293461001469997 (Finnn)`

## 2026-03-09 post-enqueue timing instrumentation

Added targeted slow-path timing logs to separate the four phases between Discord message receipt and the first model call. All logs use a 3 second slow-path threshold; they always fire in verbose mode and promote to `runtime.log` when slow.

### What changed

- `src/discord/monitor/message-handler.process.ts`
  - timing around `dispatchReplyFromConfig(...)` — logs dispatch duration after it completes
  - timing around the full `processDiscordMessageSerializedPhase(...)` — logs total serialized-phase duration
  - fields: channelId, messageId, sessionKey

- `src/auto-reply/reply/agent-runner.ts`
  - timing around `runMemoryFlushIfNeeded(...)` — logs memory flush duration
  - timing around `runAgentTurnWithFallback(...)` — logs total model turn duration
  - fields: sessionKey, queueKey, provider, model

- `src/auto-reply/reply/agent-runner-execution.ts`
  - timing for first-model-attempt boundary inside `runWithModelFallback`'s run callback
  - measures gap from `runAgentTurnWithFallback` entry to when the first provider/model attempt starts
  - covers auth profile resolution, cooldown checks, fallback candidate evaluation
  - fields: sessionKey, provider, model

### Greppable log prefixes

| Phase | Log prefix |
|---|---|
| Dispatch duration | `discord post-enqueue dispatch` |
| Serialized phase total | `discord serialized-phase total` |
| Memory flush | `agent-runner memory-flush` |
| Model turn total | `agent-runner turn-with-fallback` |
| First model attempt gap | `agent-runner first-model-attempt` |

These complement the existing pre-enqueue logs:

| Phase | Log prefix |
|---|---|
| Preflight | `discord pre-enqueue preflight` |
| Pre-enqueue total | `discord pre-enqueue handler-to-enqueue` |

### What this separates

With the existing pre-enqueue instrumentation plus these new logs, the full timeline from Discord message receipt to model call is now decomposed into:

1. Discord preflight delay (pre-enqueue, already instrumented)
2. Dispatch delay (post-enqueue: media resolution, session recording, through agent run)
3. Memory flush delay (isolated within dispatch)
4. First model start delay (gap from turn entry to actual provider call)
5. Total serialized phase (end-to-end from worker pickup to keyed-queue release)

### Validation

Focused local validation:

```bash
pnpm vitest src/discord/monitor/message-handler.process.test.ts src/discord/monitor/message-handler.queue.test.ts src/discord/monitor/message-handler.bot-self-filter.test.ts src/auto-reply/reply/agent-runner-helpers.test.ts src/auto-reply/reply/agent-runner-utils.test.ts src/auto-reply/reply/agent-runner-payloads.test.ts --run
```

All tests passed. No new type errors introduced (pnpm tsgo shows only pre-existing errors in unrelated files).

## 2026-03-09 post-enqueue typing-start stall fix

The next confirmed post-enqueue stall was not memory flush or first-model-start. It was Discord typing startup, which runs after enqueue but before the deeper reply/model path settles.

### Verified mechanism

- `src/auto-reply/reply/agent-runner.ts`
  - awaited `typingSignals.signalRunStart()` before the deeper run path
- `src/discord/monitor/message-handler.process.ts`
  - wired that callback to `sendTyping(...)`
- `src/discord/monitor/typing.ts`
  - used `client.fetchChannel(channelId)` followed by `channel.triggerTyping()`
- `node_modules/@buape/carbon/dist/src/classes/RequestClient.js`
  - Carbon REST uses a single per-client FIFO queue

That meant a stuck or congested Carbon REST queue could block a Discord run even after the message had already been enqueued successfully.

### First mitigation

- `src/discord/monitor/typing.ts`
  - added a 2 second local timeout around the initial typing-start await
  - if typing startup exceeds that budget, the run continues instead of waiting indefinitely
- `src/discord/monitor/typing.test.ts`
  - regression coverage for late fetch completion after timeout

### Follow-up finding from live logs

After the timeout mitigation, the 20 minute stall stopped reproducing, but live logs still showed repeated:

- `discord typing start timed out after 2000ms`
- steadily increasing `queueDepth=...`
- slow post-enqueue dispatch with no corresponding slow `agent-runner` phase logs

The next verified issue was that timing out the await did **not** cancel the underlying Carbon `fetchChannel(...)` request. Repeated typing heartbeats could therefore keep adding stale requests to Carbon's FIFO queue and delay later Discord sends.

### Additional mitigation

- `src/discord/monitor/typing.ts`
  - now suppresses new typing starts for the same channel while an older timed-out typing request is still unresolved
  - this caps typing-related queue growth instead of letting heartbeats stack indefinitely
- `src/discord/monitor/typing.test.ts`
  - regression coverage for the timed-out-but-still-unresolved case

### Why this helps

- Discord runs no longer wait minutes just to begin typing.
- Timed-out typing heartbeats can no longer pile up unbounded stale work in Carbon's serial REST queue.
- Live logs still expose queue depth so remaining Discord delivery contention can be investigated with evidence.

## Remaining follow-up

1. Watch live logs for `preflight-channel-info` timeouts and queue-depth context on the VPS.
2. Watch for `discord slow post-enqueue dispatch` and `agent-runner slow` logs to identify the dominant phase.
3. If timeouts still occur often, consider moving preflight channel metadata off Carbon's queued REST client entirely.
4. Surface queue metrics in the monitor UI or richer status views used during live incident response.
5. If `first-model-attempt` gap is large, investigate auth profile cooldown or fallback candidate resolution.
6. If dispatch is slow but memory flush and model start are fast, investigate Discord-side delivery work waiting behind queued Carbon REST operations.
