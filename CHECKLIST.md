# CHECKLIST

## Objective
Ship a stable fresh-upstream build with Bun performance path and Discord-first runtime on low-memory VPS.

## Done
- [x] Port Bun gateway files:
  - `src/gateway/server-bun.ts`
  - `src/gateway/server-runtime-state-bun.ts`
  - `src/gateway/server/ws-adapter.ts`
  - `src/gateway/server/ws-connection/message-handler-bun.ts`
  - `src/infra/bun-file-store.ts`
  - `src/gateway/server-bun.test.ts`
- [x] Switch gateway boot to Bun runtime in `src/gateway/server.impl.ts`.
- [x] Add Bun WS runtime data type in `src/gateway/server/ws-types.ts`.
- [x] Port Bun file I/O hot paths with Node fallback for tests:
  - `src/hooks/bundled/session-memory/handler.ts`
  - `src/agents/session-file-repair.ts`
- [x] Remove eager non-Discord channel loading in `src/plugins/runtime/index.ts`.
- [x] Remove major unused channel deps from `package.json` and refresh lockfile.
- [x] Focused tests passing:
  - `server-bun.test.ts`
  - `session-file-repair.test.ts`
  - `session-memory/handler.test.ts`

## Remaining
- [ ] Finish hard removal/disable of non-Discord bundled channel plugins at loader/catalog level.
- [ ] Run burn-in gateway test (`_fresh-rebase`) on alternate port with memory capture.
- [ ] Compare RSS/latency against production (`ray-deploy`) baseline.
- [ ] Deploy `_fresh-rebase` to service after burn-in passes.
- [ ] 24-hour post-deploy monitoring for restart loops and response delays.

## Smoke commands
```bash
cd /home/ray/miniAgent/_fresh-rebase
pnpm vitest src/gateway/server-bun.test.ts src/agents/session-file-repair.test.ts src/hooks/bundled/session-memory/handler.test.ts --run
timeout 10 bun src/index.ts gateway --bind loopback --port 18890
bun src/index.ts channels status --probe
```
