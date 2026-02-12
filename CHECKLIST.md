# miniAgent Implementation Checklist

**Project**: Discord-only OpenClaw fork for 1GB RAM VPS
**Status**: Phase 2 Complete, Ready for Phase 3 (1GB RAM Optimization)
**Version**: 2026.2.10-miniAgent
**Last Updated**: 2026-02-12

---

## PROGRESS SUMMARY

- ✅ **Phase 1: Fork & Channel Removal** - COMPLETE
- ✅ **Phase 2: Bun Migration** - COMPLETE (Conservative approach)
- ⏸️ **Phase 3: 1GB RAM Optimization** - NEXT (Memory & concurrency tuning)
- ⏸️ **Phase 4: Testing & Production** - PENDING

---

## ✅ PHASE 1: FORK & REMOVAL (COMPLETE)

### 1.1 Fork Repository ✅

- [x] Copy OpenClaw to miniAgent
- [x] Initialize git repository
- [x] Create working branch (ray-edition)
- [x] Setup upstream remote

### 1.2 Remove Channel Code ✅

- [x] Remove messaging channels
  - [x] Telegram (src/telegram/)
  - [x] Slack (src/slack/)
  - [x] Signal (src/signal/)
  - [x] iMessage (src/imessage/)
  - [x] WhatsApp/Web (src/web/)
  - [x] LINE (src/line/)
  - [x] BlueBubbles (extensions/bluebubbles/)
  - [x] IRC, Matrix, Feishu
- [x] Keep Discord (src/discord/ intact)
- [x] Remove browser automation
  - [x] Removed src/browser/ (created stubs)
  - [x] Removed canvas/a2ui (created stubs)
- [x] Remove mobile apps
  - [x] apps/macos/
  - [x] apps/ios/
  - [x] apps/android/
- [x] Remove local LLM (created stubs)

### 1.3 Import Cleanup ✅

- [x] Phase 1: Core Infrastructure
  - [x] Fixed channel-dock.ts
  - [x] Fixed plugins/runtime/index.ts
  - [x] Fixed agents/tools/auto-approve.ts
- [x] Phase 2: Plugin System
  - [x] Fixed directory-config.ts
  - [x] Fixed group-mentions.ts
  - [x] Fixed audit.ts
- [x] Phase 3: Outbound Messaging
  - [x] Fixed deliver.ts
  - [x] Fixed outbound-session.ts
- [x] Phase 4: Final Cleanup
  - [x] Created browser/canvas stubs
  - [x] Fixed all syntax errors

### 1.4 Baseline Testing ✅

- [x] Source compiles successfully
- [x] Gateway starts without errors
- [x] Discord integration works
- [x] Created IMPORT_AUDIT.md documentation

### 1.5 Version Management ✅

- [x] Updated to 2026.2.10-miniAgent
- [x] Fixed version warnings
- [x] Cherry-picked 5 upstream bug fixes
- [x] Created automated update workflow
  - [x] scripts/analyze-commits.sh
  - [x] scripts/auto-cherry-pick-v2.sh
  - [x] UPDATE_WORKFLOW.md

### 1.6 Commit Changes ✅

- [x] All changes committed to git
- [x] Documentation updated

---

## ✅ PHASE 2: BUN MIGRATION (COMPLETE)

**Status**: ✅ Complete (Conservative approach)
**Goal**: Migrate hot paths to Bun native APIs without breaking autonomy
**Results**: 5.5% startup improvement, streaming optimized, stability maintained
**See**: [PHASE2_SUMMARY.md](PHASE2_SUMMARY.md) for complete results

### 2.1 Identification & Analysis ✅

- [x] Identified migration targets (File I/O, SQLite, HTTP, WebSocket)
- [x] Created BUN_COMPATIBILITY.md migration matrix
- [x] Documented baseline metrics (1675ms startup, 308MB memory)
- [x] Defined conservative approach principles

### 2.2 File I/O Migration ✅

- [x] Migrated session file operations to Bun.file
- [x] Migrated memory file operations to Bun.file
- [x] Updated hooks/bundled/session-memory/handler.ts
- [x] Updated agents/session-file-repair.ts
- [x] Updated agents/pi-embedded-runner/session-manager-init.ts
- [x] Results: 5.5% startup improvement (1675ms → 1583ms)

### 2.3 SQLite Evaluation ✅

- [x] Tested Bun.sqlite features (FTS5, extensions, vector search)
- [x] Performance benchmarking (transaction mode, bulk inserts)
- [x] Decision: Keep node:sqlite (works well, migration risky)
- [x] Documented rationale in PHASE2_SUMMARY.md

### 2.4 HTTP Streaming Migration ✅

- [x] Replaced ServerResponseStub with StreamingServerResponse
- [x] Implemented Bun ReadableStream for SSE endpoints
- [x] Added client disconnection support via AbortSignal
- [x] Created 14 unit tests (all passing)
- [x] Updated src/gateway/server-bun.ts
- [x] Results: Eliminated response buffering, true incremental streaming

### 2.5 WebSocket Migration ⏸️

- [ ] Deferred (high complexity, uncertain benefit)
- [x] Already using Bun.serve for WebSocket (Phase 1 work)
- [x] Current implementation adequate for 1GB target

### 2.6 Documentation ✅

- [x] Updated BUN_COMPATIBILITY.md with results
- [x] Updated PHASE2_SUMMARY.md with metrics
- [x] Committed all changes to git

**Phase 2 Summary**:

- ✅ File I/O migrated (5.5% faster startup)
- ✅ HTTP Streaming optimized (no buffering)
- ✅ SQLite evaluated (kept node:sqlite)
- ✅ Gateway stability maintained
- ⏸️ WebSocket/HTTP webhooks deferred (low ROI)

---

## ⏸️ PHASE 3: 1GB RAM OPTIMIZATION (NEXT)

**Status**: Not started
**Goal**: Optimize memory usage and concurrency for 1GB RAM VPS
**Target**: ~200-250MB idle memory, stable under load
**Approach**: Aggressive memory management, reduced concurrency, context compaction

### 3.1 Concurrency Tuning ✅

**Problem**: Default concurrency settings designed for 8GB+ servers
**Status**: COMPLETE (2026-02-12)

- [x] **Reduce maxConcurrent agents**
  - [x] Current: 4 concurrent agents
  - [x] Target: 2 concurrent agents (50% reduction)
  - [x] Hard-code lower defaults in `src/config/agent-limits.ts`

- [x] **Reduce subagent concurrency**
  - [x] Current: 8 concurrent subagents
  - [x] Target: 4 concurrent subagents (50% reduction)
  - [x] Update agent-limits.ts defaults

- [x] **Add memory pressure detection**
  - [x] Monitor RSS memory usage (via memory-monitor.ts)
  - [x] Trigger GC when memory > 900MB
  - [x] Emergency shutdown when > 950MB to prevent OOM killer

**Results**:

- Gateway idle memory: 312MB RSS ✅ (target: <350MB)
- Memory monitor active with 3-tier alerting (850/900/950MB)
- Concurrency reduced to prevent memory spikes from parallel agents

### 3.2 Context Window Management ⏸️

**Problem**: Large context windows consume significant memory

- [ ] **Implement aggressive context compaction**
  - [ ] Reduce default max context length
  - [ ] More frequent compaction triggers
  - [ ] Prune tool results more aggressively

- [ ] **Optimize message history**
  - [ ] Limit conversation history depth
  - [ ] Compress old messages to summaries
  - [ ] Clear tool call intermediates faster

- [ ] **Model-specific limits**
  - [ ] Use smaller context windows for Sonnet (32k → 16k recommended)
  - [ ] Configure per-model memory budgets
  - [ ] Disable streaming for very large responses

### 3.3 Memory Budget Allocation ⏸️

**1GB RAM breakdown (target)**:

- System/OS: ~100MB
- Node.js/Bun runtime: ~80MB
- Discord.js + gateway: ~80MB
- Agent loop (1 active): ~150MB per agent × 2 = 300MB
- Context/messages: ~100MB buffer
- SQLite/memory: ~50MB
- **Total**: ~710MB (leaving 290MB headroom)

Tasks:

- [ ] Profile actual memory usage per component
- [ ] Set hard limits on agent memory consumption
- [ ] Implement memory budget enforcement

### 3.4 SQLite Memory Configuration ⏸️

**Problem**: SQLite cache can grow unbounded

- [ ] **Add SQLite memory limits**
  - [ ] Set `PRAGMA cache_size` to reasonable value (e.g., 2000 pages = 8MB)
  - [ ] Configure `PRAGMA mmap_size` for memory-mapped I/O limits
  - [ ] Use `PRAGMA temp_store = MEMORY` cautiously

- [ ] **Optimize queries**
  - [ ] Add indexes to hot queries
  - [ ] Use prepared statements (reuse query plans)
  - [ ] Limit result set sizes

### 3.5 Garbage Collection Tuning ⏸️

**Problem**: Bun's GC may not be tuned for low-memory environments

- [ ] **Configure Bun GC settings**
  - [ ] Test `BUN_FORCE_GC` environment variable
  - [ ] Experiment with heap size limits
  - [ ] Profile GC pauses during agent execution

- [ ] **Code optimization**
  - [ ] Reduce object allocations in hot paths
  - [ ] Use object pooling where beneficial
  - [ ] Clear large buffers explicitly

### 3.6 Discord Integration Optimization ⏸️

**Problem**: discord.js can consume memory with large servers

- [ ] **Minimize cached data**
  - [ ] Reduce cached messages (current default: 200)
  - [ ] Disable presence updates if not needed
  - [ ] Limit cached guild members

- [ ] **Configure intents**
  - [ ] Use minimal required intents
  - [ ] Avoid `GUILD_PRESENCES` if possible
  - [ ] Review `GUILD_MEMBERS` necessity

### 3.7 Monitoring &Alerts ⏸️

- [ ] **Add memory monitoring**
  - [ ] Log RSS memory every minute
  - [ ] Alert when memory > 850MB
  - [ ] Auto-compact sessions at 900MB

- [ ] **Create diagnostics endpoint**
  - [ ] Expose memory stats via WebSocket
  - [ ] Show active agent count
  - [ ] Display context window sizes

### 3.8 Testing Under Load ⏸️

- [ ] **Stress test with 1GB limit**
  - [ ] Run agent with `--max-old-space-size=1024`
  - [ ] Simulate multiple concurrent conversations
  - [ ] Monitor for OOM crashes

- [ ] **Validate production scenarios**
  - [ ] Multiple Discord channels active
  - [ ] Large message history
  - [ ] Long-running agent sessions

**Phase 3 Deliverables**:

- Concurrency defaults tuned for 1GB
- Context compaction strategy implemented
- Memory monitoring and alerts
- Stable operation under 1GB limit
- Documentation of memory optimization

---

## ⏸️ PHASE 4: CONFIG SIMPLIFICATION (PENDING)

- [ ] **Run compatibility audit**

  ```bash
  cd /home/ray/miniAgent
  bun install
  bun run src/index.ts --version  # Test basic functionality
  ```

- [ ] **Create compatibility matrix**

  Test each critical dependency:

  | Dependency                    | Type      | Bun Compatible? | Action                 |
  | ----------------------------- | --------- | --------------- | ---------------------- |
  | @mariozechner/pi-coding-agent | Core      | ?               | Test                   |
  | @anthropic-ai/sdk             | API       | ?               | Test                   |
  | sqlite3/better-sqlite3        | Native    | ?               | Try Bun.sqlite         |
  | ws                            | WebSocket | ?               | Replace with Bun.serve |
  | express/hono                  | HTTP      | ?               | Replace with Bun.serve |
  | Next.js                       | Web UI    | ?               | Test or keep Node      |
  | winston/tslog                 | Logging   | ?               | Test                   |

- [ ] **Document incompatibilities**
  - [ ] List any packages that don't work with Bun
  - [ ] Find Bun-compatible alternatives
  - [ ] Create fallback plan

### 2.2 Migrate Hot Paths to Bun APIs

**Priority 1: Gateway WebSocket Server** ⭐

- [ ] **Identify current implementation**

  ```bash
  grep -r "WebSocket\|ws\|Server" src/gateway/server*.ts
  ```

- [ ] **Migrate to Bun.serve**

  Current (Node.js):

  ```typescript
  import WebSocket from "ws";
  const wss = new WebSocket.Server({ port: 3000 });
  ```

  Target (Bun):

  ```typescript
  import { serve } from "bun";
  const server = serve({
    port: 3000,
    websocket: {
      open(ws) {
        /* ... */
      },
      message(ws, msg) {
        /* ... */
      },
      close(ws) {
        /* ... */
      },
    },
    fetch(req, server) {
      if (server.upgrade(req)) return;
      return new Response("Gateway");
    },
  });
  ```

- [ ] **Modify files**
  - [ ] `src/gateway/server.impl.ts` (or main gateway file)
  - [ ] Test WebSocket connections
  - [ ] Verify message handling

**Priority 2: File I/O** ⭐

- [ ] **Audit file operations**

  ```bash
  grep -r "fs\.readFile\|fs\.writeFile\|readFileSync" src/ --include="*.ts"
  ```

- [ ] **Migrate hot paths to Bun.file**

  Identify frequently-called file operations:
  - [ ] Session loading/saving
  - [ ] Memory file I/O
  - [ ] Cron job persistence

  Current (Node.js):

  ```typescript
  import fs from "fs/promises";
  const content = await fs.readFile("file.json", "utf-8");
  ```

  Target (Bun):

  ```typescript
  const file = Bun.file("file.json");
  const content = await file.text();
  // Write: await Bun.write('file.json', data);
  ```

- [ ] **Files to migrate**
  - [ ] `src/session/` files
  - [ ] `src/memory/manager.ts`
  - [ ] `src/cron/service/store.ts`
  - [ ] Others as identified

**Priority 3: SQLite Database** ⭐ **OPTIONAL**

- [ ] **Decision tree: Should we migrate?**
  - [ ] Test if Bun.sqlite supports FTS (if you use it)
  - [ ] Test if Bun.sqlite supports extensions (if you use any)
  - [ ] Run performance benchmark (Bun.sqlite vs better-sqlite3)
  - [ ] **Decision**: Migrate ONLY if features work AND performance improves
  - [ ] **Default**: Keep better-sqlite3 (works perfectly with Bun)

- [ ] **Check current SQLite usage** (if migrating)

  ```bash
  grep -r "sqlite\|Database" src/memory/ --include="*.ts"
  ```

- [ ] **Try Bun.sqlite first**

  ```typescript
  import { Database } from "bun:sqlite";
  const db = new Database("memory.sqlite");
  const query = db.query("SELECT * FROM memories");
  ```

- [ ] **Test migration**
  - [ ] Create test database
  - [ ] Verify all queries work
  - [ ] Check performance vs better-sqlite3

- [ ] **Fallback plan**
  - [ ] If Bun.sqlite missing features, keep better-sqlite3
  - [ ] Test better-sqlite3 native compilation with Bun

**Priority 4: HTTP Server (Webhooks)**

- [ ] **Identify webhook endpoints**

  ```bash
  grep -r "app\.post\|app\.get\|router\|express\|fastify" src/
  ```

- [ ] **Migrate to Bun.serve**

  Current (Express/Fastify):

  ```typescript
  const app = express();
  app.post("/hooks/wake", handler);
  ```

  Target (Bun):

  ```typescript
  const server = serve({
    port: 3001,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/hooks/wake" && req.method === "POST") {
        return handler(req);
      }
      return new Response("Not found", { status: 404 });
    },
  });
  ```

- [ ] **Test webhooks**
  - [ ] Wake endpoint
  - [ ] Other hook endpoints
  - [ ] Verify POST/GET handling

### 2.3 Keep Node.js for Complex Parts (If Needed)

- [ ] **Assess web UI (Next.js)**
  - [ ] Try running with Bun
  - [ ] If issues, keep Node.js for web UI only
  - [ ] Document hybrid approach

- [ ] **Assess TUI (Ink/React)**
  - [ ] Test with Bun
  - [ ] May need Node.js if terminal rendering breaks

### 2.4 Performance Testing

**IMPORTANT**: Test autonomy SLOs after each migration slice

- [ ] **Autonomy SLO verification**
  - [ ] Cron skew: 95% of jobs within 60s of scheduled time
  - [ ] Heartbeat drift: Average ±10% of configured interval
  - [ ] Webhook latency: p95 <1s under normal load
  - [ ] Gateway uptime: No crashes during 24hr test (recommended)

- [ ] **Benchmark startup time**

  ```bash
  # Before (Node.js)
  time node src/index.ts --version

  # After (Bun)
  time bun src/index.ts --version
  ```

  Target: <1 second

- [ ] **Benchmark memory usage**

  ```bash
  # Run gateway and monitor
  bun src/index.ts gateway &
  PID=$!
  while true; do
    ps -p $PID -o rss= | awk '{print $1/1024 "MB"}'
    sleep 5
  done
  ```

  Target: <300MB baseline

- [ ] **Benchmark WebSocket throughput**
  - [ ] Send 1000 messages
  - [ ] Measure latency
  - [ ] Compare Node vs Bun

### 2.5 Commit Bun Migration

- [ ] Create migration branch
- [ ] Commit each API migration separately
- [ ] Test after each commit
- [ ] Document performance gains
- [ ] Merge to main

---

## ⏸️ PHASE 3: CONFIG SIMPLIFICATION (PENDING)

**Status**: Not started
**Goal**: Simplify configuration to .env + minimal config file

### 3.1 Analyze Current Config

- [ ] **Review config structure**

  ```bash
  find config/ -name "*.ts" -o -name "*.json"
  cat config/config.ts  # Main config file
  ```

- [ ] **Identify what's needed**
  - [ ] API keys (Anthropic, etc.)
  - [ ] Discord token
  - [ ] Gateway settings
  - [ ] Memory/embedding settings
  - [ ] Skill configurations
  - [ ] What can be removed?

### 3.2 Create .env Template

- [ ] **Create .env.example**

  ```bash
  # Core
  ANTHROPIC_API_KEY=sk-ant-...
  DISCORD_TOKEN=...

  # Gateway
  GATEWAY_PORT=18789
  GATEWAY_HOST=127.0.0.1

  # Memory
  EMBEDDING_MODEL=voyage-2
  MEMORY_DIR=./memory

  # Skills
  ENABLED_SKILLS=search,code,terminal
  ```

- [ ] **Document each variable**
- [ ] **Create setup script**

### 3.3 Simplify Config Loading

- [ ] **Modify config loader**
  - [ ] Load from .env first
  - [ ] Fallback to config file
  - [ ] Validate required fields

- [ ] **Remove unused config**
  - [ ] Channel configs (Telegram, Slack, etc.)
  - [ ] Browser config
  - [ ] Mobile app config

- [ ] **Test config loading**
  ```bash
  # Should work with just .env
  cp .env.example .env
  # Edit .env
  bun src/index.ts config show
  ```

### 3.4 Update Documentation

- [ ] Update README with .env setup
- [ ] Create CONFIGURATION.md
- [ ] Add troubleshooting guide

---

## ⏸️ PHASE 4: TESTING & OPTIMIZATION (PENDING)

**Status**: Not started
**Goal**: Comprehensive testing and optimization for 1GB VPS

### 4.1 Feature Testing

**Autonomy Features**

- [ ] **Test cron jobs**

  ```bash
  bun src/index.ts cron list
  bun src/index.ts cron add --schedule "0 9 * * *" --task "daily report"
  # Verify execution
  ```

- [ ] **Test heartbeat**
  - [ ] Configure heartbeat in config
  - [ ] Verify periodic checks
  - [ ] Check logging

- [ ] **Test webhooks**
  ```bash
  curl -X POST http://localhost:3001/hooks/wake \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}'
  ```

**Memory System**

- [ ] **Test vector search**
  - [ ] Store memories
  - [ ] Query similar memories
  - [ ] Verify relevance

- [ ] **Test memory persistence**
  - [ ] Restart gateway
  - [ ] Verify memories survive

**Skills System**

- [ ] **Test skill execution**
  - [ ] List all 51 skills
  - [ ] Test 10 most important skills
  - [ ] Verify outputs

**Discord Integration**

- [ ] **Test bot connection**
  - [ ] Connects to Discord
  - [ ] Responds to messages
  - [ ] Handles commands

- [ ] **Test Discord features**
  - [ ] Thread creation
  - [ ] Reactions
  - [ ] File uploads

### 4.2 Load Testing

- [ ] **Stress test gateway**

  ```bash
  # Send 100 concurrent WebSocket connections
  for i in {1..100}; do
    wscat -c ws://localhost:18789 &
  done
  ```

- [ ] **Monitor resource usage**
  - [ ] CPU usage under load
  - [ ] Memory growth over time
  - [ ] Check for memory leaks

- [ ] **Test session limits**
  - [ ] Create 100+ conversations
  - [ ] Verify cleanup
  - [ ] Check memory usage

### 4.3 Memory Optimization

- [ ] **Profile memory usage**

  ```bash
  bun --inspect src/index.ts gateway
  # Use Chrome DevTools to profile
  ```

- [ ] **Optimize hot paths**
  - [ ] Reduce object allocations
  - [ ] Use object pooling if needed
  - [ ] Cache frequently accessed data

- [ ] **Configure limits**
  - [ ] Session history length
  - [ ] Embedding cache size
  - [ ] Memory index size

- [ ] **Test with limits**
  - [ ] Verify <1GB RAM usage
  - [ ] Run for 24 hours
  - [ ] Check for growth

### 4.4 Crash Recovery Testing

- [ ] **Test graceful shutdown**

  ```bash
  bun src/index.ts gateway &
  PID=$!
  kill -SIGTERM $PID  # Should save state and exit
  ```

- [ ] **Test ungraceful shutdown**

  ```bash
  kill -9 $PID  # Verify recovery on restart
  ```

- [ ] **Test out of memory**
  - [ ] Simulate OOM condition
  - [ ] Verify graceful degradation

### 4.5 Integration Testing

- [ ] **Test full workflow**
  1. Start gateway
  2. Connect Discord bot
  3. Send message
  4. Trigger skill
  5. Store in memory
  6. Query memory
  7. Cron job executes
  8. Heartbeat checks
  9. Webhook triggers
  10. All working together

### 4.6 Benchmarking

- [ ] **Document performance metrics**

  | Metric            | Target | Actual |
  | ----------------- | ------ | ------ |
  | Startup time      | <1s    | ?      |
  | Memory baseline   | <300MB | ?      |
  | Memory under load | <800MB | ?      |
  | Message latency   | <100ms | ?      |
  | Skill execution   | <2s    | ?      |

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All Phase 1-4 tasks complete
- [ ] Source compiles cleanly
- [ ] All tests passing
- [ ] Documentation updated

### VPS Preparation

- [ ] **Server requirements**
  - [ ] 1GB RAM minimum
  - [ ] Linux OS (Ubuntu/Debian preferred)
  - [ ] SSH access configured
  - [ ] Firewall configured

- [ ] **Install Bun**

  ```bash
  curl -fsSL https://bun.sh/install | bash
  source ~/.bashrc
  bun --version
  ```

- [ ] **Install system dependencies**
  ```bash
  sudo apt update
  sudo apt install git build-essential
  ```

### Transfer Code

- [ ] **Option A: Git push**

  ```bash
  # On local
  git remote add vps user@vps:/opt/miniAgent
  git push vps ray-edition

  # On VPS
  cd /opt/miniAgent
  git pull
  ```

- [ ] **Option B: rsync**

  ```bash
  rsync -avz /home/ray/miniAgent/ user@vps:/opt/miniAgent/ \
    --exclude node_modules --exclude .git --exclude dist
  ```

- [ ] **Install dependencies**
  ```bash
  cd /opt/miniAgent
  bun install
  ```

### Configuration

- [ ] **Setup .env**

  ```bash
  cp .env.example .env
  nano .env  # Add credentials
  ```

- [ ] **Set environment**

  ```bash
  export OPENCLAW_HOME=/opt/miniAgent
  echo 'export OPENCLAW_HOME=/opt/miniAgent' >> ~/.bashrc
  ```

- [ ] **Test configuration**
  ```bash
  bun src/index.ts config show
  bun src/index.ts gateway --help
  ```

### Service Setup

- [ ] **Create systemd service**

  ```bash
  sudo nano /etc/systemd/system/miniagent.service
  ```

  ```ini
  [Unit]
  Description=miniAgent Discord Bot
  After=network.target

  [Service]
  Type=simple
  User=ray
  WorkingDirectory=/opt/miniAgent
  Environment="NODE_ENV=production"
  Environment="OPENCLAW_HOME=/opt/miniAgent"
  ExecStart=/home/ray/.bun/bin/bun src/index.ts gateway
  Restart=always
  RestartSec=10

  [Install]
  WantedBy=multi-user.target
  ```

- [ ] **Enable service**
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable miniagent
  sudo systemctl start miniagent
  sudo systemctl status miniagent
  ```

### Post-Deployment

- [ ] **Monitor for 24 hours**

  ```bash
  # Check logs
  sudo journalctl -u miniagent -f

  # Check memory
  free -h
  top -p $(pgrep -f miniAgent)
  ```

- [ ] **Verify functionality**
  - [ ] Discord bot online
  - [ ] Responds to messages
  - [ ] Skills work
  - [ ] Cron jobs execute
  - [ ] Memory searches work

- [ ] **Setup monitoring**
  - [ ] Install htop or netdata
  - [ ] Configure log rotation
  - [ ] Setup alerts (optional)

---

## 🔄 MAINTENANCE

### Weekly

- [ ] Check upstream updates

  ```bash
  git fetch upstream main
  bash scripts/analyze-commits.sh
  ```

- [ ] Review logs for errors
- [ ] Check memory usage trends

### Monthly

- [ ] Apply upstream bug fixes

  ```bash
  # Edit scripts/auto-cherry-pick-v2.sh
  bash scripts/auto-cherry-pick-v2.sh
  ```

- [ ] Update dependencies

  ```bash
  bun update
  ```

- [ ] Review configuration
- [ ] Backup data

---

## ✅ SUCCESS CRITERIA

### Phase 1 (Complete)

- [x] Codebase 40% smaller
- [x] 30+ fewer dependencies
- [x] Source compiles and runs
- [x] Discord integration works

### Phase 2 (Pending)

- [ ] Runs with Bun runtime
- [ ] Startup <1 second
- [ ] Memory <300MB baseline

### Phase 3 (Pending)

- [ ] Simple .env configuration works

### Phase 4 (Pending)

- [ ] All autonomy features work
- [ ] Memory system functional
- [ ] Deployed to 1GB VPS
- [ ] 24+ hours uptime

---

## CURRENT STATUS

**Completed**: Phase 1 (Channel removal, import cleanup, version management)

**Next**: Phase 2 - Bun Migration

**What Phase 2 involves**:

- Migrate WebSockets, file I/O, SQLite to Bun APIs
- Target: <1s startup, <300MB memory
- See [PHASE2_WORKFLOW.md](PHASE2_WORKFLOW.md) for step-by-step guide

**Implementation Phases**:

- Phase 1: Channel removal and cleanup (DONE)
- Phase 2: Bun migration (PENDING - next major work)
- Phase 3: Config simplification (PENDING)
- Phase 4: Testing & optimization (PENDING)

---

**Quick Reference**:

- [START_HERE.md](START_HERE.md) - Current status overview
- [PHASE2_WORKFLOW.md](PHASE2_WORKFLOW.md) - Phase 2 step-by-step guide
- [UPDATE_WORKFLOW.md](UPDATE_WORKFLOW.md) - How to update from upstream
- [IMPORT_AUDIT.md](IMPORT_AUDIT.md) - Phase 1 cleanup history
- [FORK_PLAN.md](FORK_PLAN.md) - Complete migration plan
