# OpenClaw Architecture Analysis - REVISED

## Complete Systems-Level Understanding Including Autonomy Features

**IMPORTANT CORRECTION**: The initial analysis missed critical autonomous operation features.
This revised document includes the complete picture.

Created: 2026-02-11 (Revised)
Purpose: Document OpenClaw's COMPLETE architecture including autonomy features

---

## CRITICAL CORRECTION: What I Missed

The initial analysis portrayed OpenClaw as a **reactive chatbot** - only responding to user messages.

**This was WRONG.**

OpenClaw is an **AUTONOMOUS AGENT PLATFORM** with:

- **Crons**: Scheduled tasks (daily briefings, reminders, recurring automation)
- **Heartbeat**: Periodic awareness (background monitoring even without user activity)
- **Hooks/Webhooks**: Event-driven triggers (external systems can wake the agent)
- **System Events**: Context injection (async signals embedded in agent runs)
- **Memory System**: Long-term recall (vector-indexed markdown files)

These features enable the agent to:

- Run tasks on schedules (without user asking)
- Stay aware of context changes (check email every 30 minutes)
- React to external events (webhooks from Gmail, Slack, GitHub)
- Remember facts across sessions (semantic search over memory files)

---

## 1. COMPLETE ARCHITECTURE (With Autonomy)

```
┌───────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Web Panel   │  │     TUI      │  │  Messaging Platforms │   │
│  │  (Next.js)   │  │  (ink/React) │  │  (Discord/Telegram)  │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬────────────┘   │
└─────────┼──────────────────┼────────────────────┼────────────────┘
          │                  │                    │
          └──────────────────┴────────────────────┘
                             │ RPC (Unix Socket)
┌────────────────────────────▼───────────────────────────────────────┐
│                    GATEWAY / DAEMON                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  RPC Server (method dispatch, event streaming)               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────────── AUTONOMY LAYER ──────────────────────────┐ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │ Cron Service │  │   Heartbeat  │  │  Hooks/Webhooks  │  │ │
│  │  │  (Timer)     │  │   Runner     │  │  (HTTP Server)   │  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │ │
│  │         │                  │                   │            │ │
│  │         └──────────┬───────┴───────────────────┘            │ │
│  │                    │                                        │ │
│  │         ┌──────────▼──────────────────┐                    │ │
│  │         │   System Event Queue        │                    │ │
│  │         │  (in-memory, ephemeral)     │                    │ │
│  │         └──────────┬──────────────────┘                    │ │
│  └────────────────────┼───────────────────────────────────────┘ │
│                       │                                          │
│  ┌────────────────────▼──────────────────────────────────────┐  │
│  │           Auto-Reply Engine / Agent Dispatcher            │  │
│  │  - Routes messages from channels/crons/heartbeat/hooks    │  │
│  │  - Builds prompts with context + memory + system events   │  │
│  │  - Invokes Pi-Agent Orchestrator                          │  │
│  └────────────────────┬──────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────────────┐
│                    APPLICATION LAYER                               │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              PI-AGENT ORCHESTRATOR                         │   │
│  │  - Setup SDK session                                       │   │
│  │  - Subscribe to events                                     │   │
│  │  - Call session.prompt() → SDK LOOP                        │   │
│  │  - Stream results                                          │   │
│  └──────────────────┬─────────────────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────────────┐
│                        DOMAIN LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  SDK Wrapper │  │  Tool System │  │   Memory System      │    │
│  │  @mariozechner│  │  - bash      │  │  - memory_search     │    │
│  │  /pi-coding- │  │  - read      │  │  - memory_get        │    │
│  │   agent      │  │  - write     │  │  - MEMORY.md         │    │
│  │              │  │  - web-fetch │  │  - memory/*.md       │    │
│  │  THE ACTUAL  │  │  - glob/grep │  │  - Vector index      │    │
│  │  AGENT LOOP  │  │              │  │  - Hybrid search     │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   LLM APIs   │  │  File System │  │   Vector Database      │  │
│  │  - Anthropic │  │  - Sessions  │  │  - SQLite + embeddings │  │
│  │  - OpenAI    │  │  - Workspace │  │  - Hybrid BM25+vector  │  │
│  │  - Google    │  │  - Memory MD │  │  - Embedding cache     │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. AUTONOMY LAYER: THE HEART OF THE SYSTEM

### 2.1 Cron Service ⏰ **SCHEDULED TASKS**

**Location**: `src/cron/`

**What**: Precise scheduled task execution (like Unix cron)

**Why Essential**:

- Daily briefings at exact times (7 AM sharp)
- Recurring reminders (weekly reports)
- One-shot delayed tasks ("remind me in 20 minutes")

**Architecture**:

```
CronService
  ├─ Timer (ARM → FIRE → REARM loop)
  │   └─ Checks for due jobs every second (max 60s delay)
  ├─ Store (SQLite: ~/.openclaw/cron/jobs.json)
  └─ Executor
      ├─ Main target: enqueue system event + optional heartbeat
      └─ Isolated target: spawn dedicated agent session
```

**Event Loop**:

```javascript
armTimer() {
  const nextDueMs = findNextDueJob();
  const delay = Math.min(nextDueMs - now, 60000); // cap at 60s
  setTimeout(() => onTimer(), delay);
}

onTimer() {
  const dueJobs = jobs.filter(j => j.nextRunAtMs <= now);
  dueJobs.forEach(job => executeJobCore(job));
  rearmTimer(); // schedule next check
}
```

**Job Execution**:

- **Main mode**: Adds text to system event queue → triggers heartbeat
- **Isolated mode**: Spawns `cron:<jobId>` session → posts summary to main

**Error Handling**: Exponential backoff (30s → 1m → 5m → 15m → 60m)

**Persistence**: All jobs persisted to disk, survive daemon restart

---

### 2.2 Heartbeat Runner 💓 **PERIODIC AWARENESS**

**Location**: `src/infra/heartbeat-runner.ts`

**What**: Background monitoring that runs even without user activity

**Why Essential**:

- Agent checks for new emails/notifications periodically
- Surfaces important events without user asking
- Maintains awareness of context changes

**Architecture**:

```
HeartbeatRunner
  ├─ Interval Timer (default: 30 minutes per agent)
  ├─ Coalescing Wake Handler (debounces requests within 250ms)
  └─ Active Hours Filter (timezone-aware)
```

**Execution Model**:

```
Every 30 minutes:
  1. Read HEARTBEAT.md from workspace
  2. Check if within active hours
  3. Skip if effectively empty
  4. Inject system events into prompt
  5. Run agent with heartbeat prompt
  6. Strip HEARTBEAT_OK token if no content
  7. Deliver to configured target (last/none/specific channel)
  8. Store lastHeartbeatText to prevent duplicates
```

**System Events Integration**:

- Cron jobs enqueue events → picked up by next heartbeat
- Webhooks enqueue events → agent sees them
- Events are ephemeral (in-memory, max 20 per session)

**Coalescing**: Multiple heartbeat requests within 250ms merged into one

---

### 2.3 Hooks & Webhooks 🔗 **EVENT-DRIVEN AUTOMATION**

**Location**: `src/gateway/hooks.ts`, `src/gateway/server/hooks.ts`

**What**: External systems can trigger agent behavior via HTTP

**Why Essential**:

- Gmail → webhook → agent processes new email
- GitHub → webhook → agent comments on PR
- Slack → webhook → agent responds to @mention
- CI/CD → webhook → agent reviews build failures

**Endpoints**:

```
POST /hooks/wake
  Body: { text: "New email from boss" }
  → Enqueues system event, optionally triggers heartbeat

POST /hooks/agent
  Body: { prompt: "Review this PR", ... }
  → Spawns isolated agent turn immediately

POST /hooks/<custom-name>
  → Mapped via config (templates + transforms)
```

**Hook Mappings**:

```json5
{
  hooks: {
    gmail: {
      path: "/hooks/gmail",
      action: "wake",
      template: "New email: {{payload.subject}}",
      wakeMode: "now",
    },
    "github-pr": {
      path: "/hooks/github",
      action: "agent",
      sessionTarget: "isolated",
      prompt: "Review PR: {{payload.pull_request.url}}",
    },
  },
}
```

**Security**: Token validation (`Authorization: Bearer` or `x-openclaw-token`)

---

### 2.4 System Event Queue 📬 **CONTEXT INJECTION**

**Location**: `src/infra/system-events.ts`

**What**: In-memory queue of events to inject into next agent run

**Why Essential**:

- External signals (webhooks) → embedded in agent context
- Async notifications → agent sees them on next heartbeat
- Decouples event ingestion from agent execution

**Architecture**:

```
SystemEventQueue (per-session)
  ├─ In-memory only (ephemeral)
  ├─ Max 20 events per session (FIFO)
  └─ Injected into prompt prefix
```

**Flow**:

```
Webhook arrives → enqueue("New email from boss")
  ↓
Next heartbeat triggers
  ↓
Build prompt: [System Events] + HEARTBEAT.md + conversation
  ↓
Agent sees "New email from boss" in context
  ↓
Agent decides to read email, draft response, etc.
```

---

### 2.5 Complete Autonomy Data Flow

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│  Cron   │  │Heartbeat│  │ Webhook │
│  Timer  │  │ Timer   │  │  HTTP   │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │             │
     └────────────┴─────────────┘
                  │
       ┌──────────▼──────────┐
       │  System Event Queue │
       │    (ephemeral)      │
       └──────────┬──────────┘
                  │
     ┌────────────▼────────────┐
     │  Auto-Reply Engine      │
     │  Build prompt:          │
     │  [Events] + Context +   │
     │  Memory + User Message  │
     └────────────┬────────────┘
                  │
     ┌────────────▼────────────┐
     │  Pi-Agent Orchestrator  │
     │  Call SDK with prompt   │
     └────────────┬────────────┘
                  │
     ┌────────────▼────────────┐
     │  Agent Loop (SDK)       │
     │  LLM + Tools + Memory   │
     └────────────┬────────────┘
                  │
     ┌────────────▼────────────┐
     │  Response               │
     │  - To user              │
     │  - To channel           │
     │  - Write to memory      │
     └─────────────────────────┘
```

---

## 3. MEMORY SYSTEM: LONG-TERM RECALL

### 3.1 What It Is

**Format**: Markdown files as source of truth

- `MEMORY.md` - Curated long-term facts (decisions, preferences, people)
- `memory/YYYY-MM-DD.md` - Daily append-only logs (running notes)
- Optional extra paths (team docs, shared notes)

**Index**: SQLite database with vector embeddings

- Location: `~/.openclaw/memory/{agentId}.sqlite`
- Schema: files, chunks, embeddings, full-text search (FTS5)
- Optional: `sqlite-vec` extension for fast K-NN search

**Search**: Hybrid BM25 + Vector similarity

- Vector: Semantic similarity (embeddings)
- BM25: Keyword matching (exact tokens)
- Combined: `score = 0.7 * vectorScore + 0.3 * BM25Score`

---

### 3.2 Memory Tools (Agent Interface)

**Tools Available to Agent**:

1. **`memory_search`**:
   - Input: `{ query: "what did we decide about..." }`
   - Output: Ranked snippets with scores + citations
   - Description: "Mandatory recall step before answering questions about prior work, decisions, dates, people, preferences"

2. **`memory_get`**:
   - Input: `{ path: "memory/2025-02-11.md", from: 10, lines: 5 }`
   - Output: File content excerpt
   - Description: "Safe snippet read after memory_search"

**System Prompt Injection**:

```markdown
## Memory Recall

Before answering anything about prior work, decisions, dates, people,
preferences, or todos: run memory_search on MEMORY.md + memory/\*.md;
then use memory_get to pull only needed lines.
```

---

### 3.3 Memory Indexing & Sync

**Triggers**:

- File watcher (1.5s debounce on memory file changes)
- Session start (`onSessionStart: true`)
- Search execution (`onSearch: true`)
- Manual (`openclaw memory index`)

**Chunking**:

- 400 tokens per chunk (default)
- 80 token overlap (sliding window)
- Both memory files AND session transcripts (optional)

**Embedding Providers**:

- OpenAI (`text-embedding-3-small`) - default
- Gemini (`gemini-embedding-001`)
- Voyage (`voyage-4-large`)
- Local (node-llama-cpp with GGUF models)
- Auto (selects based on available API keys)

**Batch Processing**:

- OpenAI/Gemini batch API support
- Async batch jobs with polling
- Cost optimization (batch pricing cheaper)

---

### 3.4 Pre-Compaction Memory Flush

**Problem**: When session approaches token limit, context is compacted (old turns summarized/removed)

**Solution**: Before compaction, run silent agent turn to save memories

**Trigger**:

```
Session tokens > (contextWindow - 20k - 4k) = 104k tokens (for 128k window)
```

**Process**:

```
1. Detect: approaching compaction
2. System prompt: "Pre-compaction memory flush. Store durable memories now."
3. Agent runs (silent, no user sees this)
4. Agent writes to memory/YYYY-MM-DD.md
5. Agent replies: "NO_REPLY" (stripped from conversation)
6. Compaction proceeds
7. Memories preserved in markdown files
```

**Result**: Long conversations don't lose context permanently

---

### 3.5 Memory Data Flow

```
Agent execution starts
  ↓
System prompt injected with memory instructions
  ↓
Agent has memory_search + memory_get tools
  ↓
┌──────────────────────────────────────┐
│ Agent decides: need to recall?      │
└───┬──────────────────────────────┬───┘
    │                              │
   YES                            NO
    │                              │
    ▼                              ▼
┌─────────────────────┐    Continue without
│ memory_search(query)│    memory lookup
│   ↓                 │
│ Embed query vector  │
│   ↓                 │
│ Vector search       │
│   ↓                 │
│ BM25 search         │
│   ↓                 │
│ Merge & score       │
│   ↓                 │
│ Return snippets     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ memory_get(path)    │
│ Read specific lines │
└──────┬──────────────┘
       │
       ▼
Agent generates response
with recalled context
  ↓
(Optional) Near compaction?
  ↓
Silent memory flush turn
  ↓
Write to memory/*.md
```

---

## 4. REVISED COMPONENT DEPENDENCY MAP

```
PRESENTATION LAYER
  └─ Web Panel, TUI, Messaging Channels
            │
            ▼
GATEWAY / DAEMON (NEW: Autonomy Hub)
  ├─ RPC Server
  ├─ Cron Service ⭐ AUTONOMOUS
  ├─ Heartbeat Runner ⭐ AUTONOMOUS
  ├─ Hooks/Webhooks ⭐ AUTONOMOUS
  └─ System Event Queue ⭐ AUTONOMOUS
            │
            ▼
APPLICATION LAYER
  ├─ Auto-Reply Engine (context builder)
  └─ Pi-Agent Orchestrator (SDK wrapper)
            │
            ▼
DOMAIN LAYER
  ├─ Pi-Coding-Agent SDK (agent loop)
  ├─ Tool System (bash, read, write, etc.)
  └─ Memory System ⭐ NEW
      ├─ Vector index (SQLite)
      ├─ Embedding engine
      └─ Hybrid search
            │
            ▼
INFRASTRUCTURE LAYER
  ├─ LLM APIs (Anthropic, OpenAI, etc.)
  ├─ File System (sessions, workspace, memory MD)
  └─ Vector Database (SQLite + embeddings)
```

---

## 5. WHAT CAN BE REMOVED? (REVISED)

### Summary Table (CORRECTED)

| Component                                 | Keep?       | Note                                   |
| ----------------------------------------- | ----------- | -------------------------------------- |
| **Pi-Agent Orchestrator**                 | ✅ CORE     | The heart                              |
| **SDK (@mariozechner/pi-coding-agent)**   | ✅ CORE     | The brain                              |
| **Gateway/Daemon**                        | ✅ CORE     | **NOT just RPC - autonomy hub**        |
| **Cron Service**                          | ⚠️ AUTONOMY | Remove = no scheduled tasks            |
| **Heartbeat Runner**                      | ⚠️ AUTONOMY | Remove = no background awareness       |
| **Hooks/Webhooks**                        | ⚠️ AUTONOMY | Remove = no external triggers          |
| **System Event Queue**                    | ⚠️ AUTONOMY | Needed if keeping cron/heartbeat/hooks |
| **Memory System**                         | ⚠️ RECALL   | Remove = no long-term memory           |
| **Tool System (bash, read, write, etc.)** | ✅ CORE     | Essential                              |
| **Messaging Tool**                        | ❌ REMOVE   | Only for channels                      |
| **TUI**                                   | ✅ KEEP     | Your UI                                |
| **Web Panel**                             | ✅ KEEP     | Your UI                                |
| **Discord Channel**                       | ⚠️ OPTIONAL | If you want Discord                    |
| **Other Channels**                        | ❌ REMOVE   | You don't use these                    |

---

## 6. CRITICAL INSIGHT: REACTIVE vs AUTONOMOUS

**Reactive Agent (what I wrongly designed)**:

- User asks → Agent responds
- No background operation
- Chat interface only
- Like a fancy chatbot

**Autonomous Agent (what OpenClaw actually is)**:

- Scheduled tasks run without user asking
- Background monitoring (heartbeat every 30m)
- External events trigger agent (webhooks)
- Long-term memory across sessions
- Truly agentic behavior

**Example Scenarios**:

**Reactive only**:

```
User: "Remind me about the meeting tomorrow"
Agent: "I'll remember that"
[Tomorrow comes, agent does nothing because no heartbeat/cron]
```

**With autonomy**:

```
User: "Remind me about the meeting tomorrow"
Agent: Creates cron job for tomorrow 9 AM
[Tomorrow 9 AM: cron fires → agent sends reminder]
```

**Reactive only**:

```
[New email arrives]
[Agent never knows because no webhook/heartbeat]
```

**With autonomy**:

```
[New email arrives → Gmail webhook → agent notified]
[Next heartbeat (30m): agent checks, sees system event, processes email]
```

---

## 7. FILES TO STUDY FOR COMPLETE UNDERSTANDING

### Autonomy Features:

- `src/cron/service/timer.ts` - Cron event loop
- `src/infra/heartbeat-runner.ts` - Heartbeat scheduler
- `src/infra/heartbeat-wake.ts` - Coalescing wake handler
- `src/infra/system-events.ts` - Event queue
- `src/gateway/hooks.ts` - Hook config resolution
- `src/gateway/server/hooks.ts` - Webhook handlers
- `src/gateway/server.impl.ts` - Gateway startup (integrates all autonomy)

### Memory System:

- `src/memory/manager.ts` - Index manager
- `src/memory/memory-schema.ts` - SQLite schema
- `src/agents/tools/memory-tool.ts` - Tool definitions
- `src/auto-reply/reply/memory-flush.ts` - Pre-compaction flush

### Agent Core (unchanged):

- `src/agents/pi-embedded-runner/run/attempt.ts` - Orchestrator
- `src/agents/pi-embedded-subscribe.ts` - Event streaming
- `src/agents/pi-tools.ts` - Tool system

---

## CONCLUSION

OpenClaw is **NOT** "agent + UI". It's:

- **Agent core** (reasoning, tools, streaming)
- **Autonomy layer** (crons, heartbeat, hooks, system events)
- **Memory system** (vector search, long-term recall)
- **Gateway/Daemon** (orchestrates all autonomy)
- **UI layer** (web, TUI, messaging)

For a minimal version, you must decide:

- Keep autonomy? → Need gateway/daemon with cron/heartbeat/hooks
- Remove autonomy? → Just reactive chatbot (much simpler but loses agentic behavior)
- Keep memory? → Need vector index, embeddings, search
- Remove memory? → Agent is stateless across sessions (loses context)

**The trade-offs are significant.**

See MINIMAL_DESIGN_REVISED.md for recommendations.
