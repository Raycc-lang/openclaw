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

## Next priorities
1. Complete full non-Discord channel removal at plugin loader/catalog level (not only runtime imports).
2. Burn-in test on alternate port and compare RSS to production baseline.
3. Cut over service to `_fresh-rebase` only after burn-in is stable.
