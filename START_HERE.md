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

## Discord latency fixes

Discord latency investigations and fixes are tracked in `DISCORD_LATENCY_FIXES.md`.

Current state:

- 2026-03-08 added the dedicated `discord-inbound` lane, delivery hardening, and raw REST fetch timeouts.
- 2026-03-09 confirmed same-session post-enqueue head-of-line blocking and changed the inbound worker to release the keyed session queue after replies are queued instead of after full Discord delivery settles.
- The separate pre-enqueue 120 second timeout path is still open.

Operational tuning:

To increase Discord concurrency on a VPS, raise:

```bash
openclaw config set agents.defaults.maxConcurrent 4
```

Both `main` and `discord-inbound` lanes inherit this value.

## VPS deployment

### Connection

- SSH alias: `ssh vps` (root user)
- Codebase location on VPS: `/root/miniAgent`
- Workspace (config/sessions): `/root/.openclaw`

### Runtime

- Bun: `/root/.bun/bin/bun` (v1.3.10)
- Node: v22.22.0, pnpm: 10.23.0 (available but gateway runs via bun)
- Proxy: `HTTP_PROXY=http://127.0.0.1:10809`, `HTTPS_PROXY=http://127.0.0.1:10809`

### systemd service

- Unit: `openclaw-gateway.service` (`/etc/systemd/system/openclaw-gateway.service`)
- ExecStart: `/root/.bun/bin/bun --smol /root/miniAgent/src/index.ts gateway`
- Env vars set in unit: `OPENCLAW_SKIP_CANVAS_HOST=1`, `OPENCLAW_SKIP_UPDATE_CHECK=1`
- Control: `systemctl stop/start/restart openclaw-gateway.service`
- Logs: `journalctl -u openclaw-gateway.service -f`

### Deploy procedure

```bash
# 1. Stop the gateway
ssh vps "systemctl stop openclaw-gateway.service"

# 2. Rsync from local _fresh-rebase (no .git, node_modules, dist, apps, etc.)
rsync -az \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='apps' \
  --exclude='Swabble' \
  --exclude='.pi' \
  --exclude='.vscode' \
  /home/ray/miniAgent/_fresh-rebase/ vps:/root/miniAgent/

# 3. Install deps on VPS
ssh vps "cd /root/miniAgent && /root/.bun/bin/bun install"

# 4. Restart
ssh vps "systemctl start openclaw-gateway.service"

# 5. Verify
ssh vps "systemctl status openclaw-gateway.service"
```

### Notes

- No git on VPS; codebase is deployed via rsync, not git pull.
- `bun install` (without `--frozen-lockfile`) is required because bun's pnpm-lock migration doesn't support workspace links.
- The web panel requires `dist/control-ui/` assets. Build locally with `node scripts/ui.js build` then rsync `dist/control-ui/` to the VPS (rsync excludes `dist/` by default).
- `gateway.controlUi.enabled` must be `true` in `/root/.openclaw/openclaw.json` for the web panel to work.
- Discord bot name: **Finnn** (user ID `1477293461001469997`).
- Gateway auth token is in `/root/.openclaw/openclaw.json` under `gateway.auth.token`.

## Next priorities

1. Complete full non-Discord channel removal at plugin loader/catalog level (not only runtime imports).
2. Burn-in test on alternate port and compare RSS to production baseline.
3. Cut over service to `_fresh-rebase` only after burn-in is stable.
