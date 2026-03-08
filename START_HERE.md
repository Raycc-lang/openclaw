# START_HERE

## What this repo is
`miniAgent` is a customized OpenClaw fork focused on Discord-first operation and low-memory VPS stability.

## Branches and directories you need to know
- Main working tree: `/home/ray/miniAgent`
- Fresh upstream integration tree: `/home/ray/miniAgent/_fresh-rebase`
- Current fresh-upstream branch: `miniagent/fresh-upstream-2026-3-2`

## Current status (2026-03-03)
- Bun gateway path is enabled in `_fresh-rebase` (`Bun.serve` runtime state wired in `src/gateway/server.impl.ts`).
- Bun hot-path file I/O is enabled (with Node fallback for tests):
  - `src/hooks/bundled/session-memory/handler.ts`
  - `src/agents/session-file-repair.ts`
- Non-Discord channels are removed from eager runtime loading in `src/plugins/runtime/index.ts`.

## Quick start
```bash
cd /home/ray/miniAgent/_fresh-rebase
pnpm install
OPENCLAW_SKIP_CANVAS_HOST=1 OPENCLAW_SKIP_UPDATE_CHECK=1 bun --smol src/index.ts gateway --bind loopback --port 18789
```

In another shell:
```bash
cd /home/ray/miniAgent/_fresh-rebase
bun src/index.ts channels status --probe
```

## Useful validation commands
```bash
cd /home/ray/miniAgent/_fresh-rebase
pnpm vitest src/gateway/server-bun.test.ts src/agents/session-file-repair.test.ts src/hooks/bundled/session-memory/handler.test.ts --run
```

## Known environment note
You may see stale config warnings for removed plugins (for example `google-antigravity-auth`).
These are config hygiene warnings, not gateway startup blockers.

## Discord latency fixes (2026-03-08)

Three patches landed to fix ~5-minute reply delays on Discord:

### 1. Dedicated Discord inbound lane
Live Discord user messages now run on a `discord-inbound` lane instead of sharing the global `main` lane with cron, heartbeat, and CLI work. This prevents background tasks from blocking user-facing replies.

- `src/process/lanes.ts` — new `CommandLane.DiscordInbound`
- `src/gateway/server-lanes.ts` / `src/gateway/server-reload-handlers.ts` — lane concurrency (inherits `agents.defaults.maxConcurrent`)
- `src/auto-reply/reply/get-reply-run.ts:509` — routes Discord turns onto the new lane
- `src/auto-reply/reply/queue/types.ts`, `agent-runner-utils.ts`, `followup-runner.ts` — threads `lane` through followup queue

### 2. Discord delivery hardening
- Outer retry layer no longer retries Carbon `RateLimitError` (avoids double 429 retry stacking)
- Per-attempt success/failure logging with elapsed time in `src/discord/monitor/reply-delivery.ts`

### 3. Fetch timeouts on raw Discord REST paths
- 15s `AbortSignal.timeout` on webhook sends (`src/discord/send.outbound.ts`)
- 15s `AbortSignal.timeout` on voice upload requests (`src/discord/voice-message.ts`)
- Carbon `rest.post()`/`rest.patch()` already has internal timeouts (not changed)

### Operational tuning
To increase Discord concurrency on a VPS, raise:
```bash
openclaw config set agents.defaults.maxConcurrent 4
```
Both `main` and `discord-inbound` lanes inherit this value.

## Next priorities
1. Complete full non-Discord channel removal at plugin loader/catalog level (not only runtime imports).
2. Burn-in test on alternate port and compare RSS to production baseline.
3. Cut over service to `_fresh-rebase` only after burn-in is stable.
