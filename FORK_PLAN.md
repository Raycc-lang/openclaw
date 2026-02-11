# miniAgent Fork Implementation Plan

## Complete Guide: OpenClaw → miniAgent (Bun-Optimized, Autonomous, Channel-Free)

Version: 1.0
Created: 2026-02-11
Estimated Timeline: 3-4 weeks

---

## OVERVIEW

**Strategy**: Fork OpenClaw → Remove channels → Migrate to Bun → Simplify config

**Why this approach**:

- ✅ Keep 12+ battle-tested components (lanes, broadcast, prompt building, etc.)
- ✅ 3-4 weeks vs 6-8 weeks building from scratch
- ✅ Most code works with Bun as-is
- ✅ Incremental optimization (not all-or-nothing)

**What we're doing**:

1. Fork OpenClaw codebase
2. Remove messaging channel infrastructure (~30% of code)
3. Test with Bun (audit compatibility)
4. Migrate hot paths to Bun APIs
5. Simplify configuration
6. Optimize and document

---

## PHASE 1: FORK & REMOVAL (Week 1)

### 1.1 Fork the Repository

```bash
cd /home/ray

# Create fork
cp -r openclaw miniAgent
cd miniAgent

# Initialize git (optional, for tracking changes)
git init
git add .
git commit -m "Initial fork from OpenClaw"
git branch -M main

# Create working branch
git checkout -b remove-channels
```

### 1.2 Remove Channel Infrastructure

**Complete removal list**:

#### Directories to DELETE entirely:

```bash
# Messaging platform adapters
rm -rf src/channels/discord/
rm -rf src/channels/telegram/
rm -rf src/channels/slack/
rm -rf src/channels/whatsapp/
rm -rf src/channels/sms/
rm -rf src/channels/sessions/      # Keep or remove? (sessions might be for web)

# Platform integrations
rm -rf src/integrations/discord/
rm -rf src/integrations/telegram/
rm -rf src/integrations/

# Channel-specific tests
find src/channels -name "*.test.ts" -delete
```

**Check**: After removal, does `src/channels/` still have useful code?

- If empty: `rm -rf src/channels/`
- If has base types: keep `src/channels/types.ts` or similar

#### Files to DELETE:

```bash
# Auto-reply channel routing (keep prompt building logic)
rm src/auto-reply/reply/channel-router.ts  # (if exists)

# Remove channel-specific auto-reply logic
# CAREFUL: Keep src/auto-reply/reply/agent-runner.ts (prompt building)
# Only remove channel routing, not core prompt assembly
```

#### Files to MODIFY (remove channel references):

**src/gateway/server.impl.ts** or similar:

- Remove channel startup (`startGatewaySidecars` channel initialization)
- Keep: cron, heartbeat, hooks, broadcast

**/package.json**:

- Remove dependencies:
  ```json
  "discord.js": "...",
  "telegraf": "...",
  "@slack/bolt": "...",
  "twilio": "...",
  // etc.
  ```

**src/commands/daemon.ts** (or index.ts):

- Remove channel command handlers
- Keep: daemon, tui, agent, cron, memory, heartbeat, etc.

**tsconfig.json**:

- May need to update paths if channels had special config

### 1.3 Audit Removal Impact

```bash
# Search for remaining channel references
grep -r "discord" src/
grep -r "telegram" src/
grep -r "slack" src/
grep -r "whatsapp" src/

# If found, check if:
# 1. Can be removed
# 2. Is a type/interface that can be stubbed
# 3. Is actually needed (rare)
```

### 1.4 Test Baseline (Node.js)

**Don't migrate to Bun yet - test that removal didn't break core**

```bash
# Install dependencies (Node.js for now)
npm install  # or pnpm install

# Test daemon starts
node src/index.ts daemon --help

# Try starting daemon
node src/index.ts daemon
# Should start without channel errors

# Test agent run (if CLI exists)
node src/index.ts agent "test message"

# Test cron
node src/index.ts cron list

# Test memory
node src/index.ts memory status
```

**Success criteria**:

- ✅ Daemon starts without errors
- ✅ No missing module errors
- ✅ Cron, heartbeat, hooks available
- ✅ Agent can run
- ✅ Memory system works

### 1.5 Commit Removal Changes

```bash
git add .
git commit -m "Remove messaging channels (Discord, Telegram, Slack, WhatsApp, SMS)"
```

---

## PHASE 2: BUN MIGRATION (Week 2)

### 2.1 Bun Compatibility Audit

**Test Bun installation**:

```bash
which bun  # Should show /home/ray/.bun/bin/bun
bun --version
```

**Audit dependencies**:

```bash
# Install with Bun
bun install

# Check for errors
# Common issues:
# - Native modules (node-gyp)
# - Binary dependencies
# - Peer dependency warnings (can ignore)
```

**Create compatibility matrix**:

| Dependency                    | Type      | Bun Compatible? | Notes                   | Action                             |
| ----------------------------- | --------- | --------------- | ----------------------- | ---------------------------------- |
| @mariozechner/pi-coding-agent | Core      | ✅ Test         | TypeScript, should work | Test                               |
| @anthropic-ai/sdk             | API       | ✅ Likely       | Pure JS/TS              | Test                               |
| sqlite3 / better-sqlite3      | Native    | ⚠️ Check        | Native module           | May need Bun.sqlite or alternative |
| ws                            | WebSocket | ⚠️ Replace      | Node.js WS              | Use Bun.serve()                    |
| express/fastify               | HTTP      | ⚠️ Replace      | Node.js HTTP            | Use Bun.serve()                    |
| ink                           | TUI       | ⚠️ Test         | React terminal          | Test with Bun                      |
| next                          | Web       | ⚠️ Experimental | SSR framework           | Test or keep Node.js for web       |
| winston                       | Logging   | ✅ Likely       | Pure JS                 | Test                               |

**Test each module**:

```bash
# Create test file
cat > test-imports.ts << 'EOF'
import { test } from 'bun:test';

// Test critical imports
test('pi-coding-agent imports', async () => {
  const { createAgentSession } = await import('@mariozechner/pi-coding-agent');
  console.log('✅ pi-coding-agent');
});

test('anthropic SDK imports', async () => {
  const Anthropic = await import('@anthropic-ai/sdk');
  console.log('✅ Anthropic SDK');
});

// Add more tests for each dependency
EOF

bun test test-imports.ts
```

### 2.2 Migrate Hot Paths to Bun APIs

**Priority 1: WebSocket Server** (Gateway)

**Before (Node.js with ws or similar)**:

```typescript
import WebSocket from "ws";
const wss = new WebSocket.Server({ port: 3000 });
```

**After (Bun.serve)**:

```typescript
import { serve } from "bun";

const server = serve({
  port: 3000,
  websocket: {
    open(ws) {
      console.log("Client connected");
    },
    message(ws, message) {
      console.log("Received:", message);
    },
    close(ws) {
      console.log("Client disconnected");
    },
  },
  fetch(req, server) {
    // Upgrade HTTP → WebSocket
    if (server.upgrade(req)) {
      return; // connection upgraded
    }
    return new Response("miniAgent Gateway");
  },
});
```

**File to modify**: `src/gateway/server.impl.ts` (or wherever gateway starts)

---

**Priority 2: File I/O** (Memory, Sessions)

**Before (Node.js fs)**:

```typescript
import fs from "fs/promises";
const content = await fs.readFile("session.json", "utf-8");
```

**After (Bun.file)**:

```typescript
const file = Bun.file("session.json");
const content = await file.text();

// Writing
await Bun.write("session.json", JSON.stringify(data));
```

**Files to consider**:

- `src/session/` - Session file I/O
- `src/memory/manager.ts` - Memory file loading
- `src/cron/service/store.ts` - Cron job persistence

**Note**: Only migrate hot paths (frequently called). One-time reads can stay Node.js fs.

---

**Priority 3: SQLite** (Memory Index)

**Check current usage**:

```bash
grep -r "sqlite" src/memory/
```

**Options**:

1. **Use Bun.sqlite** (built-in, fast):

   ```typescript
   import { Database } from "bun:sqlite";
   const db = new Database("memory.sqlite");
   ```

2. **Keep better-sqlite3** (if Bun.sqlite missing features):
   - Test if better-sqlite3 works with Bun
   - May need native compilation

**Recommendation**: Try Bun.sqlite first (zero dependencies)

---

**Priority 4: HTTP Server** (Webhooks)

**Before (express/fastify)**:

```typescript
const app = express();
app.post("/hooks/wake", handler);
app.listen(3000);
```

**After (Bun.serve)**:

```typescript
const server = serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/hooks/wake" && req.method === "POST") {
      return handleHook(req);
    }
    return new Response("Not found", { status: 404 });
  },
});
```

**File**: `src/gateway/server/hooks.ts` or similar

---

**Priority 5: Child Process** (Bash tool)

**Before (Node.js child_process)**:

```typescript
import { exec } from "child_process";
```

**After (Bun.$)**:

```typescript
import { $ } from "bun";
const result = await $`ls -la`.text();
```

**File**: `src/agents/pi-tools.ts` (bash tool implementation)

---

### 2.3 Update package.json Scripts

```json
{
  "scripts": {
    "dev": "bun --hot src/index.ts daemon",
    "tui": "bun src/index.ts tui",
    "build": "bun build src/index.ts --outfile dist/miniagent.js --target bun",
    "start": "bun dist/miniagent.js daemon",
    "test": "bun test",
    "memory:index": "bun src/index.ts memory index",
    "cron:list": "bun src/index.ts cron list"
  }
}
```

### 2.4 Test Bun Migration

```bash
# Start daemon
bun src/index.ts daemon

# In another terminal, test
bun src/index.ts cron list
bun src/index.ts memory status
bun src/index.ts agent "test"

# Check memory usage
ps aux | grep bun
```

**Success criteria**:

- ✅ Daemon starts without errors
- ✅ WebSocket server works
- ✅ Hooks endpoint works (curl test)
- ✅ Agent runs successfully
- ✅ Memory system functional
- ✅ Cron jobs can be scheduled
- ✅ Heartbeat runs
- ✅ Memory usage < 300MB

### 2.5 Commit Bun Migration

```bash
git add .
git commit -m "Migrate to Bun: WebSocket, file I/O, HTTP server, SQLite"
```

---

## PHASE 3: CONFIG SIMPLIFICATION (Week 2-3)

### 3.1 Replace Complex Config with .env

**Current (OpenClaw)**:

- `~/.openclaw/config.json` with profiles, fallback chains, team keys, etc.

**Target (miniAgent)**:

- Simple `.env` file
- Optional `miniagent.config.json` for advanced users

**Create .env template**:

```bash
cat > .env.example << 'EOF'
# LLM API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # Optional, for embeddings or fallback

# Default Model
DEFAULT_MODEL=claude-3-5-sonnet-20241022

# Workspace
WORKSPACE_DIR=/home/ray/workspace

# Gateway
GATEWAY_PORT=3000
WEBHOOK_TOKEN=your-webhook-secret-token

# Memory
MEMORY_PROVIDER=openai  # or "local" for offline embeddings
MEMORY_MODEL=text-embedding-3-small

# Heartbeat
HEARTBEAT_INTERVAL_MINUTES=30
HEARTBEAT_ACTIVE_HOURS_START=08:00
HEARTBEAT_ACTIVE_HOURS_END=22:00
HEARTBEAT_TIMEZONE=America/Los_Angeles

# Cron
CRON_MAX_JOBS=50

# Logging
LOG_LEVEL=info  # debug, info, warn, error
EOF
```

### 3.2 Modify Config Loading

**File**: `src/config/load.ts` (or wherever config is loaded)

**Replace complex profile system with**:

```typescript
export const config = {
  // LLM
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  defaultModel: process.env.DEFAULT_MODEL || "claude-3-5-sonnet-20241022",

  // Workspace
  workspaceDir: process.env.WORKSPACE_DIR || process.cwd(),

  // Gateway
  gatewayPort: parseInt(process.env.GATEWAY_PORT || "3000"),
  webhookToken: process.env.WEBHOOK_TOKEN || "",

  // Memory
  memoryProvider: process.env.MEMORY_PROVIDER || "openai",
  memoryModel: process.env.MEMORY_MODEL || "text-embedding-3-small",

  // Heartbeat
  heartbeatIntervalMinutes: parseInt(process.env.HEARTBEAT_INTERVAL_MINUTES || "30"),
  heartbeatActiveHours: {
    start: process.env.HEARTBEAT_ACTIVE_HOURS_START || "08:00",
    end: process.env.HEARTBEAT_ACTIVE_HOURS_END || "22:00",
    timezone: process.env.HEARTBEAT_TIMEZONE || "America/Los_Angeles",
  },

  // Cron
  cronMaxJobs: parseInt(process.env.CRON_MAX_JOBS || "50"),

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",
};

// Validation
if (!config.anthropicApiKey) {
  throw new Error("ANTHROPIC_API_KEY is required in .env");
}
```

### 3.3 Remove Auth Profile System

**Files to simplify**:

- `src/auth/` - Remove complex profile management
- Keep: Basic API key storage, single provider setup

**Before**: Multiple providers, fallback chains, team vs personal keys
**After**: Single provider (Anthropic), simple API key from .env

### 3.4 Test Config Simplification

```bash
# Copy example
cp .env.example .env

# Edit with real keys
nano .env

# Test
bun src/index.ts daemon
# Should load config from .env
```

### 3.5 Commit Config Changes

```bash
git add .
git commit -m "Simplify configuration: replace profiles with .env"
```

---

## PHASE 4: TESTING & OPTIMIZATION (Week 3-4)

### 4.1 Comprehensive Testing

**Test Matrix**:

| Feature            | Test                                                                                                     | Expected Result                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Daemon Start**   | `bun src/index.ts daemon`                                                                                | Starts without errors             |
| **Agent Run**      | `bun src/index.ts agent "Hello"`                                                                         | Returns response                  |
| **Cron Add**       | `bun src/index.ts cron add "test" --schedule "in 1 minute"`                                              | Job created                       |
| **Cron Fire**      | Wait 1 minute                                                                                            | Job executes, heartbeat triggered |
| **Heartbeat**      | Wait 30 min (or trigger manually)                                                                        | Reads HEARTBEAT.md, runs agent    |
| **Webhook Wake**   | `curl -X POST -H "Authorization: Bearer token" -d '{"text":"test"}' http://localhost:3000/hooks/wake`    | Event enqueued                    |
| **Webhook Agent**  | `curl -X POST -H "Authorization: Bearer token" -d '{"prompt":"test"}' http://localhost:3000/hooks/agent` | Agent runs                        |
| **Memory Index**   | `bun src/index.ts memory index`                                                                          | Indexes MEMORY.md + memory/\*.md  |
| **Memory Search**  | `bun src/index.ts memory search "query"`                                                                 | Returns results                   |
| **Session Create** | Via TUI or web                                                                                           | New session created               |
| **Session Resume** | Via TUI or web                                                                                           | Messages loaded                   |
| **TUI**            | `bun src/index.ts tui`                                                                                   | Terminal UI works                 |
| **Web Panel**      | `cd web && bun run dev`                                                                                  | Browser UI works                  |

### 4.2 Performance Benchmarking

```bash
# Measure startup time
time bun src/index.ts daemon &
# Target: < 1 second

# Measure memory (after startup, idle)
sleep 5
ps aux | grep "bun.*daemon"
# Target: < 200MB

# Measure memory (agent running)
bun src/index.ts agent "long task" &
sleep 2
ps aux | grep "bun.*agent"
# Target: < 300MB
```

### 4.3 Optimization Opportunities

**If memory > 300MB**:

1. Check for memory leaks (long-running test)
2. Reduce embedding cache size
3. Limit session history in memory
4. Lazy-load heavy dependencies

**If startup > 1s**:

1. Profile with `bun --inspect`
2. Lazy-load non-critical modules
3. Defer non-essential initialization

**If response latency high**:

1. Check LLM API latency (not our problem)
2. Optimize prompt building (cache bootstrap files)
3. Stream responses early

### 4.4 Documentation

Create missing docs:

```bash
# API reference
cat > docs/API.md  # WebSocket RPC methods, webhook endpoints

# Configuration reference
cat > docs/CONFIG.md  # All .env variables explained

# Deployment guide
cat > docs/DEPLOY.md  # VPS setup, systemd service, etc.

# Development guide
cat > docs/DEVELOPMENT.md  # How to contribute, testing, etc.
```

### 4.5 Final Cleanup

```bash
# Remove unused files
find . -name "*.test.ts" -path "*/channels/*" -delete
find . -name "*.md" -path "*/channels/*" -delete

# Remove unused dependencies
bun remove discord.js telegraf @slack/bolt twilio
# etc.

# Format code
bun run format  # if you have prettier/biome

# Final commit
git add .
git commit -m "Final cleanup and optimization"
```

---

## ROLLOUT CHECKLIST

### Pre-Deployment

- [ ] All tests pass
- [ ] Memory usage < 300MB
- [ ] Startup time < 1s
- [ ] No high-severity security warnings (`bun audit`)
- [ ] Documentation complete
- [ ] .env.example provided
- [ ] README updated

### Deployment

- [ ] VPS provisioned (1GB RAM)
- [ ] Bun installed on VPS
- [ ] Repository cloned
- [ ] .env configured with real keys
- [ ] Systemd service created
- [ ] Service starts successfully
- [ ] Test agent run
- [ ] Test cron
- [ ] Test heartbeat
- [ ] Test memory
- [ ] Monitor for 24 hours

### Post-Deployment

- [ ] Set up log rotation
- [ ] Configure backups (.miniagent/sessions/, .miniagent/memory/)
- [ ] Set up monitoring (optional)
- [ ] Document any issues
- [ ] Create runbook for common operations

---

## TROUBLESHOOTING GUIDE

### Issue: "Cannot find module X"

**Cause**: Dependency not compatible with Bun
**Solution**:

1. Check if Bun has built-in alternative (e.g., Bun.sqlite instead of sqlite3)
2. Try latest version of dependency
3. Report to Bun team or use polyfill

### Issue: Native module won't compile

**Cause**: Native addon uses node-gyp
**Solution**:

1. Find pure-JS alternative
2. Use Bun's built-in (if available)
3. Keep Node.js for that specific module (hybrid approach)

### Issue: Memory usage higher than expected

**Cause**: Memory leak or inefficient caching
**Solution**:

1. Profile with Bun inspector
2. Check embedding cache size
3. Limit session history
4. Review event listener cleanup

### Issue: WebSocket disconnects frequently

**Cause**: Bun.serve WebSocket implementation difference
**Solution**:

1. Check WebSocket ping/pong
2. Increase timeout
3. Add reconnection logic in client

---

## SUCCESS METRICS

**Phase 1 (Removal)**:

- ✅ Codebase size reduced by ~30%
- ✅ 30+ fewer dependencies
- ✅ All tests pass (without channel tests)

**Phase 2 (Bun Migration)**:

- ✅ Runs with Bun
- ✅ Startup time < 1s
- ✅ Memory < 300MB

**Phase 3 (Config)**:

- ✅ Simple .env setup
- ✅ No complex profiles needed

**Phase 4 (Testing)**:

- ✅ All autonomy features work
- ✅ Memory system functional
- ✅ Agent performs equivalently to OpenClaw

---

## TIMELINE ESTIMATE

| Phase                     | Duration      | Effort                       |
| ------------------------- | ------------- | ---------------------------- |
| 1. Fork & Removal         | 3-5 days      | Medium (careful deletion)    |
| 2. Bun Migration          | 5-7 days      | High (compatibility testing) |
| 3. Config Simplification  | 2-3 days      | Low (straightforward)        |
| 4. Testing & Optimization | 5-7 days      | Medium (thorough testing)    |
| **Total**                 | **3-4 weeks** |                              |

**Breakdown by week**:

- Week 1: Phase 1 complete, start Phase 2
- Week 2: Phase 2 complete, Phase 3 complete
- Week 3: Phase 4 testing
- Week 4: Phase 4 optimization + documentation

---

## NEXT STEPS

1. **Review this plan** - Any questions or concerns?
2. **Start Phase 1** - Fork and remove channels
3. **Test baseline** - Ensure core works with Node.js
4. **Proceed to Phase 2** - Bun migration

**Ready to begin?** Start with Phase 1.1 (Fork the Repository)

See **REMOVAL_PLAN.md** for detailed file-by-file removal checklist (next document to create).
