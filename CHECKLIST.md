# miniAgent Implementation Checklist

## Fork Approach: OpenClaw → miniAgent (Bun-Optimized)

**Status**: Planning complete, ready to execute
**Estimated Timeline**: 3-4 weeks
**Approach**: Modified fork with channel removal and Bun optimization

---

## PRE-FORK PREPARATION

- [ ] Review all planning documents
  - [ ] Read FORK_PLAN.md (complete implementation guide)
  - [ ] Read ARCHITECTURE_ANALYSIS_REVISED.md (understand OpenClaw)
  - [ ] Read REMOVAL_PLAN.md (what to remove)
  - [ ] Understand autonomy features (cron, heartbeat, hooks, memory)

- [ ] Verify environment
  - [ ] Bun installed (`which bun`)
  - [ ] Git available (`which git`)
  - [ ] OpenClaw source accessible (`ls /home/ray/openclaw`)
  - [ ] Anthropic API key ready

---

## PHASE 1: FORK & REMOVAL (Week 1, 3-5 days)

### 1.1 Fork the Repository

- [ ] Copy OpenClaw to miniAgent

  ```bash
  cd /home/ray
  cp -r openclaw miniAgent
  cd miniAgent
  ```

- [ ] Initialize git (optional)

  ```bash
  git init
  git add .
  git commit -m "Initial fork from OpenClaw"
  ```

- [ ] Create working branch
  ```bash
  git checkout -b remove-channels
  ```

### 1.2 Audit Channel Structure

- [ ] List all channel files

  ```bash
  find src/channels -type f -name "*.ts" | head -50
  ```

- [ ] Identify platform-specific code

  ```bash
  grep -r "discord\|telegram\|slack" src/channels --include="*.ts" | cut -d: -f1 | sort -u
  ```

- [ ] Identify what to keep
  - [ ] Check `src/channels/web/` (needed for web panel?)
  - [ ] Check `src/channels/plugins/` (generic vs platform-specific?)
  - [ ] Check `src/channels/allowlists/` (access control?)

### 1.3 Remove Channel Code

- [ ] Create removal script

  ```bash
  mkdir -p scripts
  # Copy script from REMOVAL_PLAN.md
  chmod +x scripts/remove-channels.sh
  ```

- [ ] Run removal script

  ```bash
  ./scripts/remove-channels.sh
  ```

- [ ] Manual cleanup of remaining references
  - [ ] Review search results from script
  - [ ] Remove platform-specific imports
  - [ ] Stub out channel types if needed

- [ ] Remove channel dependencies

  ```bash
  bun remove @slack/bolt @slack/web-api discord-api-types
  # Add others as found
  ```

- [ ] Modify gateway startup
  - [ ] Open `src/gateway/server.impl.ts` (or similar)
  - [ ] Remove channel service initialization
  - [ ] Keep: web server, cron, heartbeat, hooks

- [ ] Modify CLI commands
  - [ ] Remove channel management commands
  - [ ] Keep: daemon, tui, agent, cron, memory, heartbeat

### 1.4 Test Baseline (Node.js)

**Don't migrate to Bun yet - verify removal didn't break core**

- [ ] Install dependencies

  ```bash
  npm install  # or pnpm install
  ```

- [ ] Check for errors
  - [ ] No missing module errors
  - [ ] TypeScript compiles (`npm run typecheck` or `tsc --noEmit`)

- [ ] Test daemon startup

  ```bash
  node src/index.ts daemon --help
  # Should show help without errors
  ```

- [ ] Try starting daemon

  ```bash
  node src/index.ts daemon
  # Should start, check logs for channel errors
  # Ctrl+C to stop
  ```

- [ ] Test core commands
  ```bash
  node src/index.ts cron list
  node src/index.ts memory status
  # Should work without channel errors
  ```

### 1.5 Commit Removal

- [ ] Stage changes

  ```bash
  git add .
  ```

- [ ] Commit

  ```bash
  git commit -m "Remove messaging channels (Discord, Telegram, Slack, etc.)"
  ```

- [ ] Create backup tag
  ```bash
  git tag baseline-after-removal
  ```

---

## PHASE 2: BUN MIGRATION (Week 2, 5-7 days)

### 2.1 Bun Compatibility Audit

- [ ] Install with Bun

  ```bash
  bun install
  ```

- [ ] Note any warnings
  - [ ] Native module warnings
  - [ ] Peer dependency issues (can usually ignore)
  - [ ] Incompatible packages

- [ ] Create compatibility test file

  ```bash
  # Copy test-imports.ts from FORK_PLAN.md
  bun test test-imports.ts
  ```

- [ ] Test critical imports
  - [ ] @mariozechner/pi-coding-agent
  - [ ] @anthropic-ai/sdk
  - [ ] better-sqlite3 or check Bun.sqlite
  - [ ] ink (for TUI)
  - [ ] next (for web panel)

- [ ] Document compatibility issues
  - [ ] Create BUN_COMPAT.md with findings
  - [ ] Note what needs replacement
  - [ ] Note what works as-is

### 2.2 Migrate to Bun APIs

#### Priority 1: WebSocket Server

- [ ] Find current WebSocket implementation

  ```bash
  grep -r "WebSocket.Server\|ws.Server" src/gateway
  ```

- [ ] Replace with Bun.serve
  - [ ] File: `src/gateway/server.impl.ts` (or similar)
  - [ ] Use Bun.serve() with websocket option
  - [ ] Test WebSocket connection

- [ ] Test WebSocket functionality
  ```bash
  bun src/index.ts daemon &
  # In another terminal: test WS connection
  ```

#### Priority 2: File I/O

- [ ] Identify file I/O hot paths
  - [ ] Session loading/saving
  - [ ] Memory file reading
  - [ ] Cron job persistence

- [ ] Replace with Bun.file (where beneficial)
  - [ ] Session files: `src/session/`
  - [ ] Memory files: `src/memory/manager.ts`
  - [ ] Cron store: `src/cron/service/store.ts`

- [ ] Test file operations
  - [ ] Create session → verify saved
  - [ ] Load session → verify loaded
  - [ ] Memory index → verify reads files

#### Priority 3: SQLite (Memory Index)

- [ ] Check current SQLite usage

  ```bash
  grep -r "better-sqlite3\|sqlite3" src/memory
  ```

- [ ] Choose approach
  - [ ] Option A: Migrate to Bun.sqlite
  - [ ] Option B: Test better-sqlite3 with Bun
  - [ ] Option C: Keep as-is if it works

- [ ] Implement chosen approach
  - [ ] Update memory manager
  - [ ] Test indexing
  - [ ] Test search

#### Priority 4: HTTP Server (Webhooks)

- [ ] Find webhook server

  ```bash
  grep -r "express\|fastify\|createServer" src/gateway
  ```

- [ ] Replace with Bun.serve
  - [ ] Use fetch() handler for HTTP
  - [ ] Test POST /hooks/wake
  - [ ] Test POST /hooks/agent

- [ ] Test webhook endpoints
  ```bash
  curl -X POST -H "Authorization: Bearer test" \
    -d '{"text":"test"}' \
    http://localhost:3000/hooks/wake
  ```

#### Priority 5: Child Process (Bash Tool)

- [ ] Find bash tool implementation

  ```bash
  grep -r "exec\|spawn" src/agents/pi-tools.ts
  ```

- [ ] Replace with Bun.$
  - [ ] Update bash tool
  - [ ] Test command execution

- [ ] Test bash tool
  ```bash
  # Via agent: ask it to run a bash command
  bun src/index.ts agent "list files in current directory"
  ```

### 2.3 Update Package Scripts

- [ ] Edit package.json scripts
  ```json
  {
    "scripts": {
      "dev": "bun --hot src/index.ts daemon",
      "start": "bun src/index.ts daemon",
      "tui": "bun src/index.ts tui",
      "build": "bun build src/index.ts --outfile dist/miniagent.js",
      "test": "bun test"
    }
  }
  ```

### 2.4 Test Bun Migration

- [ ] Start daemon with Bun

  ```bash
  bun src/index.ts daemon
  ```

- [ ] Test agent run

  ```bash
  bun src/index.ts agent "test message"
  ```

- [ ] Test cron

  ```bash
  bun src/index.ts cron add "test" --prompt "Hello" --schedule "in 1 minute"
  bun src/index.ts cron list
  # Wait 1 minute, check if job fired
  ```

- [ ] Test memory

  ```bash
  echo "Test fact to remember" > .miniagent/MEMORY.md
  bun src/index.ts memory index
  bun src/index.ts memory search "test"
  ```

- [ ] Test heartbeat

  ```bash
  # Check heartbeat status
  bun src/index.ts heartbeat status
  # Or wait 30 minutes (or trigger if there's a command)
  ```

- [ ] Test webhooks

  ```bash
  # Daemon should be running
  curl -X POST -H "Authorization: Bearer yourtoken" \
    -d '{"text":"webhook test"}' \
    http://localhost:3000/hooks/wake
  # Check if event was enqueued
  ```

- [ ] Measure performance

  ```bash
  # Startup time
  time bun src/index.ts daemon &
  sleep 2
  pkill -f "bun.*daemon"

  # Memory usage
  bun src/index.ts daemon &
  sleep 5
  ps aux | grep "bun.*daemon"
  # Should be < 300MB
  ```

### 2.5 Commit Bun Migration

- [ ] Stage changes

  ```bash
  git add .
  ```

- [ ] Commit
  ```bash
  git commit -m "Migrate to Bun: WebSocket, file I/O, HTTP, SQLite, child process"
  ```

---

## PHASE 3: CONFIG SIMPLIFICATION (Week 2-3, 2-3 days)

### 3.1 Create .env Template

- [ ] Create .env.example

  ```bash
  # Copy from FORK_PLAN.md
  ```

- [ ] Add to .gitignore
  ```bash
  echo ".env" >> .gitignore
  ```

### 3.2 Simplify Config Loading

- [ ] Find current config system

  ```bash
  ls src/config/
  ```

- [ ] Create simple config loader
  - [ ] Read from .env
  - [ ] Validate required keys
  - [ ] Provide defaults

- [ ] Replace complex profile system
  - [ ] Remove src/auth/ complexity
  - [ ] Keep simple API key storage
  - [ ] Remove fallback chains (or simplify)

### 3.3 Update Config Usage

- [ ] Update daemon startup to use new config
- [ ] Update agent initialization to use new config
- [ ] Update memory system to use new config

### 3.4 Test Config

- [ ] Copy .env.example to .env

  ```bash
  cp .env.example .env
  ```

- [ ] Edit .env with real keys

  ```bash
  nano .env
  ```

- [ ] Test daemon starts with .env config
  ```bash
  bun src/index.ts daemon
  # Should load config from .env
  ```

### 3.5 Commit Config Changes

- [ ] Stage changes

  ```bash
  git add .
  ```

- [ ] Commit
  ```bash
  git commit -m "Simplify configuration: replace profiles with .env"
  ```

---

## PHASE 4: TESTING & OPTIMIZATION (Week 3-4, 5-7 days)

### 4.1 Comprehensive Testing

**Core Functionality**:

- [ ] Daemon starts without errors
- [ ] Agent execution works
  ```bash
  bun src/index.ts agent "What is 2+2?"
  # Should return response
  ```

**Autonomy Features**:

- [ ] Cron jobs
  - [ ] Add job: `bun src/index.ts cron add`
  - [ ] List jobs: `bun src/index.ts cron list`
  - [ ] Job fires on schedule
  - [ ] Isolated vs main target works

- [ ] Heartbeat
  - [ ] Create `.miniagent/HEARTBEAT.md`
  - [ ] Heartbeat runs every 30 minutes
  - [ ] System events injected into heartbeat
  - [ ] HEARTBEAT_OK token stripped correctly

- [ ] Webhooks
  - [ ] POST /hooks/wake enqueues event
  - [ ] POST /hooks/agent spawns isolated run
  - [ ] Token validation works
  - [ ] Custom hooks work (if configured)

**Memory System**:

- [ ] Memory indexing
  - [ ] Create `MEMORY.md`
  - [ ] Create `memory/2026-02-11.md`
  - [ ] Index: `bun src/index.ts memory index`
  - [ ] Files indexed correctly

- [ ] Memory search
  - [ ] Search: `bun src/index.ts memory search "query"`
  - [ ] Results returned with scores
  - [ ] Hybrid search works (BM25 + vector)
  - [ ] Citations included

- [ ] Memory tools in agent
  - [ ] Agent has memory_search tool
  - [ ] Agent has memory_get tool
  - [ ] Agent uses memory when appropriate
  - [ ] Pre-compaction flush works

**Sessions**:

- [ ] Create new session
- [ ] Load existing session
- [ ] Multi-turn conversation
- [ ] Session persistence across daemon restarts

**UI**:

- [ ] TUI
  - [ ] Starts: `bun src/index.ts tui`
  - [ ] Chat interface works
  - [ ] Streaming works
  - [ ] Session switching works

- [ ] Web panel
  - [ ] Starts: `cd web && bun run dev`
  - [ ] Opens in browser
  - [ ] Chat works
  - [ ] Real-time updates work

### 4.2 Performance Benchmarking

- [ ] Measure startup time

  ```bash
  time bun src/index.ts daemon &
  sleep 1 && pkill -f "bun.*daemon"
  # Target: < 1 second
  ```

- [ ] Measure idle memory

  ```bash
  bun src/index.ts daemon &
  sleep 5
  ps aux | grep "bun.*daemon" | awk '{print $6}'
  # Target: < 200MB
  ```

- [ ] Measure running memory

  ```bash
  # Run agent
  bun src/index.ts agent "long task" &
  sleep 2
  ps aux | grep "bun.*agent" | awk '{print $6}'
  # Target: < 300MB
  ```

- [ ] Profile if needed
  ```bash
  bun --inspect src/index.ts daemon
  # Use browser devtools to profile
  ```

### 4.3 Optimization

**If metrics don't meet targets**:

- [ ] Memory optimization
  - [ ] Check for memory leaks (long-running test)
  - [ ] Reduce embedding cache size
  - [ ] Limit session history loaded
  - [ ] Lazy-load heavy dependencies

- [ ] Startup optimization
  - [ ] Profile startup with `--inspect`
  - [ ] Defer non-critical initialization
  - [ ] Lazy-load modules

- [ ] Response latency
  - [ ] Check LLM API latency (not our control)
  - [ ] Cache bootstrap files
  - [ ] Stream responses earlier

### 4.4 Documentation

- [ ] Create API.md (WebSocket/HTTP API reference)
- [ ] Create CONFIG.md (all .env variables explained)
- [ ] Create DEPLOY.md (VPS setup, systemd, etc.)
- [ ] Create DEVELOPMENT.md (contributing, testing)
- [ ] Update README.md with final stats

### 4.5 Final Cleanup

- [ ] Remove unused files

  ```bash
  find . -path "*/channels/*" -name "*.test.ts" -delete
  ```

- [ ] Remove unused dependencies

  ```bash
  bun remove discord.js telegraf  # etc.
  ```

- [ ] Format code (if you have formatter)

  ```bash
  bun run format  # or prettier/biome
  ```

- [ ] Final commit
  ```bash
  git add .
  git commit -m "Final cleanup and optimization"
  git tag v1.0-fork-complete
  ```

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All tests pass
- [ ] Performance metrics met
  - [ ] Startup < 1s
  - [ ] Memory < 300MB
  - [ ] No errors in 24h test run

- [ ] Security
  - [ ] Run `bun audit`
  - [ ] No high/critical vulnerabilities
  - [ ] .env not in git

- [ ] Documentation complete
  - [ ] README.md updated
  - [ ] .env.example provided
  - [ ] Deployment guide written

### VPS Setup

- [ ] Provision 1GB RAM VPS
- [ ] Install Bun

  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- [ ] Clone repository

  ```bash
  git clone <your-repo> miniAgent
  cd miniAgent
  ```

- [ ] Configure

  ```bash
  cp .env.example .env
  nano .env  # Add real keys
  ```

- [ ] Install dependencies

  ```bash
  bun install
  ```

- [ ] Test
  ```bash
  bun src/index.ts daemon
  # Ctrl+C after verify starts
  ```

### Systemd Service

- [ ] Create service file

  ```bash
  sudo nano /etc/systemd/system/miniagent.service
  # See DEPLOY.md for template
  ```

- [ ] Enable and start

  ```bash
  sudo systemctl enable miniagent
  sudo systemctl start miniagent
  ```

- [ ] Check status
  ```bash
  sudo systemctl status miniagent
  sudo journalctl -u miniagent -f
  ```

### Post-Deployment

- [ ] Monitor for 24 hours
- [ ] Test all features in production
- [ ] Set up log rotation
- [ ] Configure backups
  - [ ] .miniagent/sessions/
  - [ ] .miniagent/memory/
  - [ ] .miniagent/cron/jobs.json

- [ ] Document any issues
- [ ] Create runbook for common operations

---

## SUCCESS CRITERIA

**Phase 1 (Removal)**:

- ✅ Codebase ~30% smaller
- ✅ 30+ fewer dependencies
- ✅ All core features work (no channels)

**Phase 2 (Bun)**:

- ✅ Runs with Bun
- ✅ Startup < 1s
- ✅ Memory < 300MB

**Phase 3 (Config)**:

- ✅ Simple .env setup
- ✅ No complex auth profiles

**Phase 4 (Testing)**:

- ✅ All autonomy features functional
- ✅ Memory system works
- ✅ Agent performs equivalently to OpenCL aw
- ✅ Deployed successfully to VPS

---

## NOTES

- Track time spent per phase
- Document unexpected issues
- Note Bun incompatibilities found
- Keep list of optimizations made

---

**Ready to start?** Begin with Phase 1.1 (Fork the Repository)

See **FORK_PLAN.md** for detailed context on each phase.
