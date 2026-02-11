# Missing Components Analysis

## What miniAgent Still Needs vs Full OpenClaw

Based on Option A (Full Autonomy), comparing our plan to OpenClaw.

---

## ✅ COVERED IN OUR PLAN

### Core Agent

- ✅ Pi-Agent Orchestrator (extract from pi-embedded-runner)
- ✅ SDK Integration (@mariozechner/pi-coding-agent)
- ✅ Event subscription (streaming)
- ✅ Tool system (bash, read, write, web-fetch, glob, grep)
- ✅ Session management (JSON files)

### Autonomy

- ✅ Cron service (scheduler + timer)
- ✅ Heartbeat runner (periodic checks)
- ✅ Hooks/webhooks (HTTP endpoints)
- ✅ System event queue (in-memory)

### Memory

- ✅ Memory index (SQLite + embeddings)
- ✅ Hybrid search (BM25 + vector)
- ✅ Memory tools (memory_search, memory_get)
- ✅ Pre-compaction flush

### UI

- ✅ TUI (planned)
- ✅ Web panel (planned)
- ✅ WebSocket server (Bun.serve)

---

## ⚠️ MISSING OR UNDERSPECIFIED

### 1. Auto-Reply Engine / Prompt Building ⭐ CRITICAL

**Location in OpenClaw**: `src/auto-reply/`

**What it does**:

- Assembles prompts from multiple sources
- Loads conversation history
- Injects bootstrap files
- Adds memory context
- Adds system events
- Builds final prompt for agent

**Why critical**: Without this, we don't know HOW to build the prompt that goes to the agent.

**Our plan status**: Mentioned but not detailed

**Action needed**: Extract prompt building logic

---

### 2. Skills System 🎯 NICE-TO-HAVE

**Location**: `.openclaw/skills/`, `src/skills/`

**What it does**:

- Discover bash scripts in workspace
- Inject skill documentation into system prompt
- Agent can invoke via bash tool

**Why useful**: Extensibility without code changes

**Our plan status**: Mentioned as optional

**Action needed**: Decide if we want it (simple to add)

---

### 3. Lanes (Concurrency Control) ⚠️ IMPORTANT

**Location**: `src/lanes/`

**What it does**:

- Prevents concurrent agent runs on same session
- Queues requests if agent is busy
- Per-session locks + optional global lane

**Why important**: Without it, cron + heartbeat + user message could run simultaneously → race conditions

**Our plan status**: NOT mentioned

**Action needed**: Add lane system or accept single-threaded execution

---

### 4. Broadcast Channel (Real-time Events) 🔔 IMPORTANT FOR UI

**Location**: `src/gateway/broadcast.ts`

**What it does**:

- Streams events to connected clients (web panel, TUI)
- Agent execution progress (tool calls, text deltas)
- Cron job triggers
- Heartbeat runs
- System events

**Why important**: Real-time UI updates

**Our plan status**: Implied by WebSocket, not detailed

**Action needed**: Implement event broadcasting

---

### 5. Session Store (Beyond Files) 📦 MEDIUM

**Location**: `src/session-store/`

**What it does**:

- In-memory cache of active sessions
- Metadata tracking (last heartbeat, last message, etc.)
- Quick lookups without file I/O

**Why useful**: Performance, state tracking

**Our plan status**: Only mentioned JSON files

**Action needed**: Add in-memory session cache

---

### 6. Model Registry + Auth Profiles 🔑 MEDIUM

**Location**: `src/auth/`, `src/config/models.ts`

**What it does**:

- Multiple LLM providers (Anthropic, OpenAI, Google, etc.)
- Fallback chains (if primary fails, try secondary)
- Profile management (team API keys vs personal)

**Our plan status**: Simple .env with single API key

**Action needed**: Decide if we want multi-provider support

---

### 7. CLI Commands 💻 USEFUL

**Location**: `src/commands/`

**What it does**:

```bash
openclaw agent "prompt"
openclaw cron list
openclaw cron add "daily briefing" --schedule "0 9 * * *"
openclaw memory search "query"
openclaw heartbeat wake
openclaw session list
```

**Why useful**: Management without opening UI

**Our plan status**: Basic TUI/web only

**Action needed**: Add CLI commands (easy with Bun)

---

### 8. Hot-Reload (Config Changes) 🔄 NICE-TO-HAVE

**Location**: `src/gateway/server-reload-handlers.ts`

**What it does**:

- Watch config files for changes
- Reload cron jobs, heartbeat settings, hooks without restart

**Why useful**: Development experience

**Our plan status**: NOT mentioned

**Action needed**: Optional, add if time

---

### 9. Graceful Shutdown 🛑 IMPORTANT

**Location**: `src/gateway/server-close.ts`

**What it does**:

- Stop accepting new requests
- Wait for in-flight agent runs to complete
- Stop cron timers
- Stop heartbeat runner
- Close WebSocket connections cleanly
- Save state

**Why important**: Data integrity, no corruption

**Our plan status**: NOT mentioned

**Action needed**: Add shutdown handler

---

### 10. Observability (Logging, Metrics) 📊 MEDIUM

**Location**: `src/logger/`, `src/metrics/`

**What it does**:

- Structured logging (Winston)
- Metrics (agent run duration, token usage, costs)
- Error tracking

**Why useful**: Debugging, cost tracking

**Our plan status**: "Basic logging"

**Action needed**: Define what "basic" means

---

### 11. Bootstrap / Context Files 📄 MEDIUM

**Location**: `src/agents/bootstrap/`

**What it does**:

- Reads files from `.openclaw/bootstrap/` on session start
- Injects into system prompt (workspace context, team info, etc.)

**Why useful**: Consistent context across conversations

**Our plan status**: NOT mentioned

**Action needed**: Add bootstrap file loading

---

### 12. Workspace Management 📁 SMALL

**Location**: `src/workspace/`

**What it does**:

- Resolve workspace directory
- Create `.miniagent/` structure
- Set working directory for tools

**Why needed**: Tools need to know where to execute

**Our plan status**: Config only

**Action needed**: Add workspace setup

---

## 🚫 EXPLICITLY REMOVING (Channels)

- ❌ Discord, Telegram, Slack, WhatsApp, SMS adapters
- ❌ Channel routing logic
- ❌ Platform-specific message formatting
- ❌ Multi-channel session mapping
- ❌ Reaction handlers, thread tracking, etc.

---

## 📋 PRIORITY RANKING

### P0 (Blocking - Must Have)

1. **Auto-reply engine / prompt building** ⭐
2. **Lanes (concurrency control)**
3. **Broadcast channel (real-time events)**
4. **Graceful shutdown**
5. **Workspace management**

### P1 (Important - Should Have)

6. **Session store (in-memory cache)**
7. **Bootstrap files**
8. **CLI commands** (at least basic ones)
9. **Observability (basic logging)**

### P2 (Nice-to-Have)

10. **Skills system**
11. **Model registry / multi-provider**
12. **Hot-reload**

---

## RECOMMENDATION: FORK APPROACH

Given how much we're keeping, I recommend:

### Strategy: Modified Fork with Bun Layer

**Approach**:

1. **Fork OpenClaw** (keep git history)
2. **Remove channel directories** (src/channels/, src/integrations/)
3. **Add Bun optimizations** where possible (Bun.serve, Bun.file, etc.)
4. **Simplify config** (remove complex profiles, use simple .env)
5. **Keep everything else** (autonomy, memory, agent core, UI)

**Why this is better than building from scratch**:

- ✅ All the missing pieces (lanes, broadcast, prompt building) already implemented
- ✅ Battle-tested code (edge cases handled)
- ✅ Consistent architecture
- ✅ Can upgrade to Bun gradually (not all-or-nothing)
- ✅ 2-3 weeks instead of 6-8 weeks

**Why this is better than using OpenClaw as-is**:

- ✅ Remove channel bloat (~30% codebase)
- ✅ Simplify config (remove complex profiles)
- ✅ Bun optimizations (faster startup, lower memory)
- ✅ Lighter dependencies

---

## HYBRID APPROACH: OpenClaw Core + Bun Wrapper

**Alternative**: Keep OpenClaw's code mostly intact, add Bun layer on top

```
miniAgent (Bun)
  ├─ src/daemon.ts (Bun.serve wrapper)
  ├─ src/tui.ts (Bun-native TUI)
  └─ openclaw-core/ (git submodule or npm package)
      ├─ Gateway/daemon logic (Node.js)
      ├─ Agent orchestrator
      ├─ Autonomy features
      └─ Memory system
```

**Pros**:

- Leverage OpenClaw code without forking
- Easy to upgrade OpenClaw
- Add Bun where it helps most (UI, WebSocket)

**Cons**:

- Still running Node.js for core
- Lose Bun memory benefits for main logic
- Awkward hybrid

---

## MY RECOMMENDATION

**Modified Fork Approach**:

```bash
# 1. Fork OpenClaw
cd /home/ray
git clone /home/ray/openclaw miniAgent-fork
cd miniAgent-fork

# 2. Remove channels (keep one branch with history)
git checkout -b remove-channels
rm -rf src/channels/ src/integrations/
git commit -m "Remove messaging channels"

# 3. Simplify config
# Edit src/config/ to use simple .env instead of profiles

# 4. Migrate to Bun gradually
# - package.json: replace "node" with "bun"
# - Test each component with Bun
# - Fix incompatibilities as found

# 5. Optimize with Bun APIs
# - Replace fs with Bun.file() where beneficial
# - Replace http with Bun.serve() where beneficial
# - Keep Node.js compatibility where Bun doesn't help
```

**Timeline**:

- Week 1: Fork, remove channels, test basic functionality
- Week 2: Simplify config, migrate to Bun
- Week 3: Test autonomy features (cron, heartbeat, hooks)
- Week 4: Test memory system
- Week 5: TUI updates (make Bun-native)
- Week 6: Web panel updates, polish

**Total**: 6 weeks (vs 8 weeks building from scratch)

---

## NEXT STEPS

1. **Decide on approach**:
   - Option 1: Modified fork (recommended)
   - Option 2: Build from scratch (extract components)
   - Option 3: Hybrid (Bun wrapper around OpenClaw)

2. **If modified fork**:
   - Fork OpenClaw repo
   - Create remove-channels branch
   - Audit dependencies (which can Bun handle?)
   - Start removing channel code

3. **If build from scratch**:
   - Use our Phase 1-6 plan
   - Extract components from OpenClaw as reference
   - Implement missing pieces (lanes, broadcast, prompt building)

**What do you prefer?**
