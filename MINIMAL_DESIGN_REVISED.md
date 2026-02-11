# miniAgent: Revised Architecture Design

## Autonomous Agent for 1GB RAM VPS (Bun-Native)

**CRITICAL UPDATE**: This revision includes autonomy features (cron, heartbeat, hooks) and memory system.

Version: 2.0 (Revised)
Date: 2026-02-11
Based on: Complete OpenClaw architecture analysis

---

## DESIGN PHILOSOPHY CHANGE

**Version 1.0 (WRONG)**:

- Reactive chatbot only
- No autonomy
- No memory
- Just UI → Agent → LLM

**Version 2.0 (CORRECT)**:

- Autonomous agent platform
- Scheduled tasks + background awareness
- Long-term memory
- Event-driven automation
- Truly agentic behavior

**Memory/Performance Impact**:

- Adding autonomy: +40MB RAM (cron service, heartbeat runner, event queue)
- Adding memory: +30MB RAM (SQLite index, embedding cache)
- **Total**: ~250MB (vs bare bones ~180MB)
- **Still fits 1GB VPS comfortably**

---

## ARCHITECTURE OPTIONS FOR YOU

### Option A: Full Autonomy (Recommended)

**What**: Complete autonomous agent with all features

**Includes**:

- ✅ Cron service (scheduled tasks)
- ✅ Heartbeat runner (periodic awareness)
- ✅ Hooks/webhooks (external triggers)
- ✅ Memory system (vector search)
- ✅ TUI + Web Panel
- ⚠️ Optional: Discord channel

**Memory**: ~250-280MB
**Complexity**: High
**Capabilities**: Full autonomous agent

**Use cases**:

- Daily briefings at specific times
- Background email monitoring
- Webhook integration with tools
- Long-term memory across sessions
- Truly autonomous assistant

---

### Option B: Background Awareness Only (Balanced)

**What**: Essential autonomy without full scheduling

**Includes**:

- ❌ Cron service (no precise scheduling)
- ✅ Heartbeat runner (still checks periodically)
- ⚠️ Simplified hooks (wake only, no isolated runs)
- ✅ Memory system (vector search)
- ✅ TUI + Web Panel

**Memory**: ~220-240MB
**Complexity**: Medium
**Capabilities**: Periodic awareness + memory

**Use cases**:

- Check for updates every 30 minutes
- Long-term memory
- Simple webhook notifications
- Can't do "remind me at 3 PM" (no cron)

---

### Option C: Reactive with Memory (Minimal Autonomy)

**What**: Chatbot with memory, no background operation

**Includes**:

- ❌ Cron service
- ❌ Heartbeat runner
- ❌ Hooks/webhooks
- ✅ Memory system (vector search)
- ✅ TUI + Web Panel

**Memory**: ~210MB
**Complexity**: Low-Medium
**Capabilities**: Smart chatbot with recall

**Use cases**:

- Conversational assistant
- Remembers past conversations
- No autonomy (only responds when asked)

---

### Option D: Pure Reactive (Version 1.0)

**What**: Bare minimum, no autonomy, no memory

**Includes**:

- ❌ All autonomy features
- ❌ Memory system
- ✅ TUI + Web Panel

**Memory**: ~180MB
**Complexity**: Low
**Capabilities**: Basic chatbot

**Use cases**:

- Simple Q&A assistant
- No memory, no autonomy
- Loses context across sessions
- **Not recommended** (too limited)

---

## RECOMMENDED: OPTION A (Full Autonomy)

**Rationale**:

1. **Still fits 1GB VPS** (~280MB leaves 720MB for OS + other processes)
2. **Autonomy is why you use OpenClaw** (otherwise just use ChatGPT web)
3. **Memory is essential** (agent that forgets is frustrating)
4. **Bun optimizations offset the weight** (faster, less memory than Node.js equivalent)

---

## REVISED ARCHITECTURE (Option A)

```
┌───────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                         │
│  ┌──────────────────┐         ┌──────────────────────────┐   │
│  │   Web Panel      │         │        TUI Client        │   │
│  │ (Vite+React/SPA) │         │                          │   │
│  └────────┬─────────┘         └─────────┬────────────────┘   │
└───────────┼───────────────────────────────┼───────────────────┘
            │                               │
            │ WebSocket                     │ WebSocket (changed!)
            │                               │ (not direct import)
┌───────────▼───────────────────────────────▼───────────────────┐
│              GATEWAY / DAEMON (Bun Process)                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  WebSocket Server (Bun.serve)                        │    │
│  │  - Method RPC (sendMessage, createSession, etc.)     │    │
│  │  - Event streaming                                   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────── AUTONOMY LAYER ──────────────────┐    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │    │
│  │  │ Cron Service │  │   Heartbeat  │  │  Hooks   │  │    │
│  │  │  (Timer)     │  │   Runner     │  │  (HTTP)  │  │    │
│  │  │              │  │   (Timer)    │  │          │  │    │
│  │  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  │    │
│  │         │                  │               │        │    │
│  │         └──────────┬───────┴───────────────┘        │    │
│  │                    │                                │    │
│  │         ┌──────────▼──────────────────┐            │    │
│  │         │   System Event Queue        │            │    │
│  │         │  (in-memory, per-session)   │            │    │
│  │         └─────────────────────────────┘            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Agent Orchestrator                                  │    │
│  │  - Build prompt (context + system events + memory)   │    │
│  │  - Call SDK session.prompt()                         │    │
│  │  - Stream events                                     │    │
│  └──────────────────┬───────────────────────────────────┘    │
└─────────────────────┼────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│                  DOMAIN LAYER (in same process)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Pi-Coding-  │  │  Tool System │  │   Memory System  │  │
│  │  Agent SDK   │  │  - bash      │  │  - memory_search │  │
│  │              │  │  - read      │  │  - memory_get    │  │
│  │  THE LOOP    │  │  - write     │  │  - SQLite index  │  │
│  │              │  │  - web-fetch │  │  - Embeddings    │  │
│  │              │  │  - glob/grep │  │  - Hybrid search │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Key Change**: TUI also connects via WebSocket (not direct import)
**Why**: Gateway needs to manage autonomy (cron/heartbeat) centrally

---

## COMPONENT SPECIFICATIONS (Revised)

### 1. Gateway/Daemon (Bun Process)

**File**: `src/daemon.ts`

**Responsibilities**:

- WebSocket server for TUI + Web Panel
- HTTP server for webhooks
- Cron service orchestration
- Heartbeat runner orchestration
- System event queue management
- Agent orchestration

**API**:

```typescript
// WebSocket RPC Methods
interface GatewayAPI {
  // Session management
  'session.create'(): { sessionId: string };
  'session.list'(): Session[];
  'session.get'(id: string): Session;

  // Agent execution
  'agent.run'(params: {
    sessionId: string;
    prompt: string;
  }): AsyncIterator<AgentEvent>;

  // Cron management
  'cron.list'(): CronJob[];
  'cron.add'(job: CronJobSpec): void;
  'cron.remove'(id: string): void;
  'cron.run'(id: string): void;

  // Heartbeat control
  'heartbeat.wake'(): void;
  'heartbeat.status'(): HeartbeatStatus;

  // System events
  'system.enqueue'(text: string): void;
  'system.list'(): SystemEvent[];
}

// HTTP Webhook Endpoints
POST /hooks/wake
POST /hooks/agent
POST /hooks/<custom-name>
```

**Implementation**:

```typescript
import { serve } from "bun";

const server = serve({
  port: 3000,
  websocket: {
    open(ws) {
      registerClient(ws);
    },
    message(ws, message) {
      handleRPCCall(ws, message);
    },
    close(ws) {
      unregisterClient(ws);
    },
  },
  fetch(req) {
    // Upgrade to WebSocket or handle webhook
    if (req.url.startsWith("/hooks/")) {
      return handleWebhook(req);
    }
    // Upgrade to WebSocket
    if (server.upgrade(req)) {
      return; // WebSocket upgraded
    }
    return new Response("miniAgent Gateway", { status: 200 });
  },
});
```

---

### 2. Cron Service (Scheduler)

**File**: `src/cron/service.ts`

**Responsibilities**:

- Manage scheduled jobs (persistent to disk)
- ARM → FIRE → REARM timer loop
- Execute jobs at scheduled times
- Error handling with exponential backoff

**Data Structure**:

```typescript
interface CronJob {
  id: string;
  enabled: boolean;
  schedule: {
    kind: "at" | "interval" | "cron";
    time?: string; // "2024-02-12T09:00:00Z"
    interval?: string; // "30m", "1h", "1d"
    cron?: string; // "0 9 * * *"
  };
  target: "main" | "isolated";
  prompt: string;
  wakeMode?: "now" | "next";
  deleteAfterRun?: boolean;
  state: {
    lastRunAtMs?: number;
    nextRunAtMs: number;
    consecutiveErrors: number;
  };
}
```

**Implementation** (extract from OpenClaw):

```typescript
class CronService {
  private jobs: CronJob[] = [];
  private timer?: Timer;
  private store: CronStore; // JSON file persistence

  async start() {
    await this.store.load();
    this.armTimer();
  }

  private armTimer() {
    const nextDue = this.findNextDue();
    if (!nextDue) return;

    const delay = Math.min(nextDue.state.nextRunAtMs - Date.now(), 60000);
    this.timer = setTimeout(() => this.onTimer(), delay);
  }

  private async onTimer() {
    const dueJobs = this.jobs.filter((j) => j.enabled && j.state.nextRunAtMs <= Date.now());

    for (const job of dueJobs) {
      await this.executeJob(job);
    }

    this.armTimer(); // rearm for next
  }

  private async executeJob(job: CronJob) {
    if (job.target === "main") {
      // Enqueue system event + trigger heartbeat
      systemEvents.enqueue(job.prompt);
      if (job.wakeMode === "now") {
        await heartbeat.wake();
      }
    } else {
      // Spawn isolated agent run
      await this.runIsolatedAgentTurn(job);
    }

    this.updateJobState(job);
    await this.store.save();
  }
}
```

**Storage**: `.miniagent/cron/jobs.json`

---

### 3. Heartbeat Runner (Periodic Awareness)

**File**: `src/heartbeat/runner.ts`

**Responsibilities**:

- Schedule periodic heartbeat checks
- Read HEARTBEAT.md from workspace
- Inject system events into prompt
- Run agent with heartbeat context
- Deliver results to configured target

**Implementation** (extract from OpenClaw):

```typescript
class HeartbeatRunner {
  private interval: number = 30 * 60 * 1000; // 30 minutes
  private timer?: Timer;

  start() {
    this.scheduleNext();
  }

  private scheduleNext() {
    const nextDueMs = Date.now() + this.interval;
    const delay = nextDueMs - Date.now();
    this.timer = setTimeout(() => this.onTimer(), delay);
  }

  private async onTimer() {
    await this.runHeartbeat();
    this.scheduleNext();
  }

  async runHeartbeat() {
    // Read HEARTBEAT.md
    const heartbeatFile = Bun.file(".miniagent/HEARTBEAT.md");
    let heartbeatPrompt = "";
    try {
      heartbeatPrompt = await heartbeatFile.text();
    } catch {
      return; // No heartbeat file, skip
    }

    if (this.isEffectivelyEmpty(heartbeatPrompt)) {
      return; // Empty heartbeat, skip
    }

    // Get system events
    const events = systemEvents.drain();
    const eventsPrefix = events.length > 0 ? `[System Events]\n${events.join("\n")}\n\n` : "";

    // Build full prompt
    const prompt = eventsPrefix + heartbeatPrompt;

    // Run agent
    const result = await agent.run({
      sessionId: "main",
      prompt,
      isHeartbeat: true,
    });

    // Strip HEARTBEAT_OK token if no content
    if (this.stripHeartbeatOk(result.text)) {
      return; // No content, don't deliver
    }

    // Deliver to target (console, channel, etc.)
    this.deliver(result);
  }

  private isEffectivelyEmpty(text: string): boolean {
    // Remove comments, headers, blank lines
    const cleaned = text
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^#.*/gm, "")
      .trim();
    return cleaned.length < 50; // threshold
  }
}
```

---

### 4. Hooks/Webhooks (Event-Driven)

**File**: `src/hooks/server.ts`

**Responsibilities**:

- HTTP server for webhooks
- Token validation
- Template rendering (for custom hooks)
- Dispatch wake or agent actions

**Implementation**:

```typescript
async function handleWebhook(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const hookName = url.pathname.replace("/hooks/", "");

  // Validate token
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token !== config.webhookToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse body
  const body = await req.json();

  // Built-in hooks
  if (hookName === "wake") {
    systemEvents.enqueue(body.text);
    if (body.wakeMode === "now") {
      await heartbeat.wake();
    }
    return new Response("OK", { status: 200 });
  }

  if (hookName === "agent") {
    // Spawn isolated agent run
    await runIsolatedAgent({
      prompt: body.prompt,
      sessionId: `hook-${Date.now()}`,
    });
    return new Response("OK", { status: 200 });
  }

  // Custom hooks (from config)
  const hookConfig = config.hooks[hookName];
  if (hookConfig) {
    const prompt = renderTemplate(hookConfig.template, { payload: body });
    if (hookConfig.action === "wake") {
      systemEvents.enqueue(prompt);
      await heartbeat.wake();
    } else {
      await runIsolatedAgent({ prompt });
    }
    return new Response("OK", { status: 200 });
  }

  return new Response("Hook not found", { status: 404 });
}
```

---

### 5. System Event Queue

**File**: `src/events/queue.ts`

**Responsibilities**:

- In-memory ephemeral queue (per-session)
- FIFO, max 20 events
- Drain into prompts

**Implementation**:

```typescript
class SystemEventQueue {
  private queues = new Map<string, string[]>(); // sessionId → events
  private maxEvents = 20;

  enqueue(sessionId: string, text: string) {
    if (!this.queues.has(sessionId)) {
      this.queues.set(sessionId, []);
    }
    const queue = this.queues.get(sessionId)!;
    queue.push(text);

    // Keep only last N events
    if (queue.length > this.maxEvents) {
      queue.shift();
    }
  }

  drain(sessionId: string): string[] {
    const events = this.queues.get(sessionId) || [];
    this.queues.delete(sessionId);
    return events;
  }

  peek(sessionId: string): string[] {
    return this.queues.get(sessionId) || [];
  }
}

export const systemEvents = new SystemEventQueue();
```

---

### 6. Memory System

**Files**:

- `src/memory/manager.ts` - Index manager
- `src/memory/index.ts` - SQLite operations
- `src/memory/embeddings.ts` - Embedding provider abstraction
- `src/memory/search.ts` - Hybrid search

**Responsibilities**:

- Index MEMORY.md + memory/\*.md files
- Generate embeddings (OpenAI/local)
- Hybrid BM25 + vector search
- Provide memory_search and memory_get tools

**Data Flow**:

```typescript
// Indexing
class MemoryManager {
  async index() {
    // Watch for file changes
    const files = await this.scanMemoryFiles();

    for (const file of files) {
      // Chunk file
      const chunks = await this.chunkFile(file, {
        tokens: 400,
        overlap: 80,
      });

      // Generate embeddings
      const embeddings = await this.embedChunks(chunks);

      // Store in SQLite
      await this.db.upsertChunks(chunks, embeddings);
    }

    // Build FTS5 index
    await this.db.buildFullTextIndex();
  }

  async search(query: string, opts: SearchOptions) {
    // Embed query
    const queryEmbedding = await this.embed(query);

    // Vector search
    const vectorResults = await this.db.vectorSearch(queryEmbedding, {
      limit: opts.maxResults * 4, // candidate multiplier
    });

    // BM25 search
    const bm25Results = await this.db.ftsSearch(query, {
      limit: opts.maxResults * 4,
    });

    // Merge & score
    const merged = this.mergeResults(vectorResults, bm25Results, {
      vectorWeight: 0.7,
      textWeight: 0.3,
    });

    // Filter by minScore
    const filtered = merged.filter((r) => r.score >= opts.minScore);

    // Return top N
    return filtered.slice(0, opts.maxResults);
  }
}
```

**Embedding Providers**:

```typescript
// Option 1: OpenAI (default)
async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

// Option 2: Local (node-llama-cpp with GGUF)
async function embedLocal(texts: string[]): Promise<number[][]> {
  // Use node-llama-cpp or alternatives compatible with Bun
  // May need to use child process if native module incompatible
  return await llamaCpp.embed(texts);
}
```

**Storage**: `.miniagent/memory/index.sqlite`

**Memory Tools** (exposed to agent):

```typescript
const memorySearchTool = {
  name: "memory_search",
  description:
    "Semantically search MEMORY.md + memory/*.md. Use before answering questions about prior work, decisions, dates, people, preferences.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
  },
  execute: async (params) => {
    const results = await memoryManager.search(params.query, {
      maxResults: 6,
      minScore: 0.35,
    });
    return results.map((r) => ({
      path: r.path,
      snippet: r.text.slice(0, 700),
      score: r.score,
      citation: `Source: ${r.path}#L${r.startLine}`,
    }));
  },
};

const memoryGetTool = {
  name: "memory_get",
  description: "Read specific lines from memory file",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      from: { type: "number" },
      lines: { type: "number" },
    },
  },
  execute: async (params) => {
    const file = await Bun.file(params.path).text();
    const allLines = file.split("\n");
    const excerpt = allLines.slice(params.from, params.from + params.lines);
    return excerpt.join("\n");
  },
};
```

---

## MEMORY OPTIMIZATION (Revised)

### Target Memory Usage (Option A: Full Autonomy)

| Component                  | Memory     |
| -------------------------- | ---------- |
| Bun runtime                | ~50MB      |
| Gateway (WebSocket + HTTP) | ~40MB      |
| Cron service               | ~10MB      |
| Heartbeat runner           | ~10MB      |
| System event queue         | ~5MB       |
| Agent service (idle)       | ~30MB      |
| Agent service (running)    | ~100MB     |
| Memory index (SQLite)      | ~20MB      |
| Memory embedding cache     | ~10MB      |
| **Total (idle)**           | **~175MB** |
| **Total (running)**        | **~275MB** |

**Headroom on 1GB VPS**: ~725MB ✅

### Optimization Strategies

1. **Lazy memory indexing**: Only index on first search
2. **Embedding cache**: Reuse cached embeddings
3. **SQLite connection pooling**: Single connection
4. **Event queue cap**: Max 20 events per session
5. **Cron job limit**: Reasonable limit (e.g., 50 jobs)
6. **Heartbeat coalescing**: Debounce rapid wake requests

---

## DEPLOYMENT WORKFLOW

### Development

```bash
# Start daemon
bun src/daemon.ts

# In another terminal: TUI
bun src/tui.ts

# In another terminal: web dev server
cd web && bun run dev
```

### Production

```bash
# Build
bun build src/daemon.ts --outfile dist/daemon.js
cd web && bun run build

# Run
bun dist/daemon.js
```

### Systemd Service

```ini
[Unit]
Description=miniAgent Daemon
After=network.target

[Service]
Type=simple
User=ray
WorkingDirectory=/home/ray/miniAgent
ExecStart=/home/ray/.bun/bin/bun dist/daemon.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

---

## CONFIGURATION

### .env

```env
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_MODEL=claude-3-5-sonnet-20241022
WORKSPACE_DIR=/home/ray/workspace
WEB_PORT=3000
WEBHOOK_TOKEN=secret-token-here

# Memory
MEMORY_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Heartbeat
HEARTBEAT_INTERVAL_MINUTES=30

# Cron
CRON_MAX_JOBS=50
```

### config.json (optional)

```json5
{
  heartbeat: {
    intervalMinutes: 30,
    activeHours: {
      start: "08:00",
      end: "22:00",
      timezone: "America/Los_Angeles",
    },
  },
  memory: {
    provider: "openai",
    model: "text-embedding-3-small",
    chunking: {
      tokens: 400,
      overlap: 80,
    },
    search: {
      maxResults: 6,
      minScore: 0.35,
      hybrid: {
        vectorWeight: 0.7,
        textWeight: 0.3,
      },
    },
  },
  hooks: {
    gmail: {
      path: "/hooks/gmail",
      action: "wake",
      template: "New email: {{payload.subject}}",
      wakeMode: "now",
    },
  },
}
```

---

## IMPLEMENTATION PHASES (Revised)

### Phase 1: Gateway + Basic Agent (Week 1-2)

- [ ] Set up bun project
- [ ] Implement WebSocket server (Bun.serve)
- [ ] Implement HTTP server (for webhooks)
- [ ] Implement AgentService (extract from OpenClaw)
- [ ] Implement tool system
- [ ] Session management
- [ ] Basic RPC methods (session.\*, agent.run)

### Phase 2: Autonomy Features (Week 2-3)

- [ ] Implement CronService (extract from OpenClaw)
- [ ] Implement HeartbeatRunner
- [ ] Implement SystemEventQueue
- [ ] Implement webhook handlers
- [ ] Integrate autonomy with agent execution
- [ ] Test: cron job triggers agent
- [ ] Test: heartbeat runs periodically
- [ ] Test: webhook enqueues event

### Phase 3: Memory System (Week 3-4)

- [ ] Implement MemoryManager
- [ ] Implement SQLite schema
- [ ] Implement embedding provider (OpenAI)
- [ ] Implement hybrid search (BM25 + vector)
- [ ] Implement memory tools (memory_search, memory_get)
- [ ] Integrate with system prompt
- [ ] Test: search works, agent recalls facts

### Phase 4: TUI (Week 4)

- [ ] Implement TUI client (WebSocket connection)
- [ ] Chat interface
- [ ] Session switcher
- [ ] Streaming display
- [ ] Cron/heartbeat status view

### Phase 5: Web Panel (Week 5-6)

- [ ] Vite + React setup
- [ ] WebSocket hook
- [ ] Chat component
- [ ] Session list
- [ ] Cron management UI
- [ ] Memory search UI

### Phase 6: Polish (Week 6)

- [ ] Error handling
- [ ] Logging
- [ ] Documentation
- [ ] VPS deployment

---

## TRADE-OFFS SUMMARY

| Feature              | Impact if Removed                                     | Memory Saved                 |
| -------------------- | ----------------------------------------------------- | ---------------------------- |
| **Cron service**     | No scheduled tasks, no "remind me at 3 PM"            | ~10MB                        |
| **Heartbeat runner** | No background awareness, agent blind between messages | ~10MB                        |
| **Hooks/webhooks**   | No external triggers, no Gmail/Slack integration      | ~15MB                        |
| **Memory system**    | No long-term recall, agent forgets across sessions    | ~30MB                        |
| **All autonomy**     | Just a reactive chatbot                               | ~70MB ❌ **Not recommended** |

**Recommendation**: Keep all features (Option A). The memory cost is acceptable for 1GB VPS, and autonomy is essential for agent usefulness.

---

## NEXT STEPS

1. **Decide**: Confirm Option A (full autonomy) or choose alternative
2. **Study OpenClaw files**:
   - `/home/ray/openclaw/src/cron/service/timer.ts`
   - `/home/ray/openclaw/src/infra/heartbeat-runner.ts`
   - `/home/ray/openclaw/src/memory/manager.ts`
3. **Start Phase 1**: Implement gateway + WebSocket server
4. **Extract autonomy code**: Port cron/heartbeat logic to bun
5. **Test incrementally**: Each phase independently

---

See ARCHITECTURE_ANALYSIS_REVISED.md for complete context.

Ready to build a truly autonomous agent? 🚀
