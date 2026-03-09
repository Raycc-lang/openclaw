# Discord Latency Handoff

## Current recommendation

The March 9 fix appears to have addressed the **post-enqueue same-session head-of-line blocking** path.

The next thing to watch is the **pre-enqueue channel-info path**. The repo now has a mitigation in place:

- guild `preflight-channel-info` no longer blocks indefinitely
- stalled guild channel lookup falls back after 2 seconds
- the log context now includes cache state and Carbon REST queue depth when available

## What was verified

- `src/discord/monitor/message-handler.preflight.ts` was still doing channel lookup before enqueue
- `src/discord/monitor/message-utils.ts` still used `client.fetchChannel(...)` on cache miss
- `node_modules/@buape/carbon/dist/src/classes/RequestClient.js` runs REST through a single FIFO queue
- the OpenClaw listener timeout does not cancel a request waiting inside that Carbon queue

Important nuance:

- Carbon does have a 15 second timeout once the HTTP request starts.
- The bigger problem is queue wait before `fetchChannel(...)` starts.

## Current code state

The relevant mitigation is now in place:

- `src/discord/monitor/message-handler.preflight.ts`
  - `preflight-channel-info` logs cache state and REST queue depth
  - guild channel-info lookup now has a 2 second local fallback budget
  - guild preflight continues with degraded metadata when that lookup stalls
- `src/discord/monitor/message-utils.ts`
  - preflight can now probe the local channel-info cache before deciding whether it is about to hit Carbon REST
- `src/discord/monitor/message-handler.preflight.test.ts`
  - regression test covers a stalled guild `fetchChannel(...)` lookup

## Best next validation on VPS

1. Deploy the current tree.
2. Reproduce or wait for a slow Discord ingress event.
3. Inspect `journalctl -u openclaw-gateway.service` for:
   - `discord guild channel info timed out after 2000ms`
   - `discord pre-enqueue preflight-channel-info`
   - `cacheState=...`
   - `queueDepth=...`
4. Confirm whether slow runs are now enqueueing quickly instead of waiting behind Carbon REST.

## If latency still remains

The next likely escalation is to bypass Carbon's queued REST client for preflight channel metadata entirely.

That would mean one of:

- a direct Discord REST fetch with its own timeout for channel metadata
- a separate non-queued REST client just for preflight channel lookup

## Focused tests

```bash
pnpm vitest src/discord/monitor/message-handler.preflight.test.ts src/discord/monitor/message-utils.test.ts --run
```

Result: passed.

## Deploy reminder

Use the documented VPS workflow from `START_HERE.md`:

1. stop `openclaw-gateway.service`
2. rsync `_fresh-rebase/` to `/root/miniAgent/`
3. run `/root/.bun/bin/bun install`
4. start the service
5. inspect logs

## Post-enqueue timing instrumentation (2026-03-09)

The post-enqueue pipeline is now fully instrumented with slow-path timing logs (3 second threshold). See `DISCORD_LATENCY_FIXES.md` for the full greppable prefix table.

Key grep commands for live diagnosis on VPS:

```bash
# Pre-enqueue delays
journalctl -u openclaw-gateway.service --since "1 hour ago" | grep -E 'slow pre-enqueue|timed out.*2000ms'

# Post-enqueue delays
journalctl -u openclaw-gateway.service --since "1 hour ago" | grep -E 'slow post-enqueue|slow serialized-phase'

# Agent runner delays (memory flush, model start)
journalctl -u openclaw-gateway.service --since "1 hour ago" | grep -E 'agent-runner slow'
```

## Current single-stage suspect

If 120 second listener timeouts still appear after this patch, the most suspicious stage remains `preflight-channel-info`, specifically queue wait inside Carbon before `fetchChannel(...)` begins.

If the pre-enqueue path is now fast but delays remain, the post-enqueue instrumentation will show which downstream phase is dominant.
