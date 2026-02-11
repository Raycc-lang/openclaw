# Phase 2: Bun Migration Workflow

**Goal**: Optimize miniAgent by migrating hot paths from Node.js APIs to Bun native APIs

**Status**: Ready to begin

**Prerequisites**: Phase 1 complete, miniAgent already functional with Bun runtime

**Important**: The code already runs on Bun (`bun src/index.ts gateway`). This phase optimizes performance by using Bun's native APIs where they provide clear benefits.

---

## Architectural Principles

Before starting any migration work, understand these foundational principles:

### 1. Gateway = Bun Runtime Boundary

**What runs on Bun (Bun-native APIs)**:

- Gateway WebSocket server (`src/gateway/`)
- Autonomy layer (cron, heartbeat, webhooks)
- All long-running server processes

**What may stay Node-backed (if needed)**:

- Web UI (Next.js panel) - communicates via HTTP/WebSocket
- TUI (Ink/React) - if Bun causes rendering issues
- Complex UI components that don't affect autonomy

**The Contract**:

- Gateway and autonomy code MUST NOT import Node-only modules
- UI components communicate with gateway over HTTP/WebSocket
- All cross-boundary communication uses standard protocols

### 2. Autonomy Stability Over API Purity

**This is a production agent on a 1GB VPS. Reliability matters more than using every Bun feature.**

**It is ACCEPTABLE to**:

- Keep `better-sqlite3` if Bun.sqlite lacks needed features (FTS, extensions, reliability)
- Keep some `fs` usage if migration introduces complexity without clear performance gain
- Leave non-hot paths on Node.js APIs

**It is NOT ACCEPTABLE to**:

- Break cron timing guarantees (jobs must fire on schedule)
- Introduce webhook latency regressions
- Compromise heartbeat reliability
- Destabilize the Discord integration

**Guideline**: If uncertain whether to migrate something, **don't**. Stability first, optimization second.

### 3. Small, Independently Shippable Slices

Each migration:

- **Isolated feature branch** (e.g., `bun-websocket`)
- **Localized changes** (one subsystem at a time)
- **Has targeted tests** and performance measurements
- **Is mergeable independently** without waiting for other slices

Avoid large, multi-system migrations that are hard to revert.

### 4. Backward-Compatible Contracts

**All external interfaces remain stable**:

- WebSocket message formats unchanged
- HTTP webhook endpoints unchanged
- Port numbers and paths unchanged
- Discord integration behavior unchanged

**If you must change a contract**:

- Add adapters or compatibility shims
- Version the change
- Document the migration path

### 5. Living Compatibility Matrix

The `BUN_COMPATIBILITY.md` file is **documentation as code**:

- Every dependency decision documented with rationale
- Hybrid runtime choices explicitly recorded
- Updated as we learn through testing
- Serves as the source of truth for "what runs where and why"

---

## Autonomy Service Level Objectives (SLOs)

Phase 2 must preserve these operational characteristics:

| Metric                  | Target                                        | Measurement                               |
| ----------------------- | --------------------------------------------- | ----------------------------------------- |
| **Cron skew**           | 95% of jobs fire within 60s of scheduled time | Log analysis, compare actual vs scheduled |
| **Heartbeat drift**     | Average interval within ±10% of configured    | Monitor heartbeat timestamps              |
| **Webhook latency**     | p95 response time <1s under nominal load      | `curl` timing, log webhook response times |
| **Gateway uptime**      | No crashes during 24hr test run               | Monitor for unexpected exits              |
| **Discord reliability** | All messages sent/received without loss       | Manual testing, message round-trips       |

**How to measure**: Create lightweight scripts that check logs and record metrics. Use benchmark scripts in Step 7.

**When to measure**: Before migration (baseline), after each slice, and during final integration test.

---

## Overview

### Current State

miniAgent **already runs on Bun** (`bun src/index.ts`), but uses Node.js APIs internally:

- WebSocket: `ws` package (Node-style)
- File I/O: `fs/promises` (Node-style)
- SQLite: `better-sqlite3` (Node-compatible native module)
- HTTP: possibly Express or native Node HTTP

### Phase 2 Goal

Replace Node.js APIs with Bun native APIs in **hot paths only**, where performance benefit is clear:

- WebSocket → `Bun.serve` with WebSocket support
- File I/O → `Bun.file` / `Bun.write` for frequent operations
- SQLite → **Evaluate** `Bun.sqlite` (optional if no clear benefit)
- HTTP → `Bun.serve` for webhooks

### Expected Benefits

- **Startup time**: <1 second (currently ~3-5s)
- **Memory baseline**: <300MB idle (currently ~500MB+)
- **Hot path performance**: 2-3x faster I/O in tight loops
- **Simpler stack**: Fewer dependencies, native primitives

---

## Migration Strategy

### Principles

1. **Conservative by default**: Only migrate what provides clear value
2. **Hot paths first**: WebSocket > File I/O > HTTP > SQLite (optional)
3. **Test incrementally**: Each slice tested independently before merging
4. **Preserve autonomy**: SLOs must hold throughout

### Risk Mitigation

- **Feature branches**: Easy to revert individual migrations
- **Baseline metrics**: Measure before/after for each slice
- **Rollback plan**: Keep working version in `ray-edition` branch
- **Hybrid option**: Document what stays on Node if needed

---

## Step-by-Step Workflow

### Step 0: Establish Baseline Metrics

**Before any migration**, capture current performance:

```bash
cd /home/ray/miniAgent

# 1. Startup time baseline
echo "Measuring startup time (10 runs)..."
for i in {1..10}; do
  /usr/bin/time -f "%E" bun src/index.ts --version 2>&1 | grep ':'
done

# 2. Memory baseline
echo "Measuring memory usage..."
bun src/index.ts gateway &
GATEWAY_PID=$!
sleep 30  # Let it stabilize
ps -p $GATEWAY_PID -o rss= | awk '{print "Baseline memory: " $1/1024 "MB"}'
kill $GATEWAY_PID

# 3. Basic functionality check
echo "Testing autonomy features..."
bun src/index.ts gateway &
GATEWAY_PID=$!
sleep 10
# Verify:
# - Gateway is running
# - No errors in logs
# - Can connect via WebSocket (manual test)
kill $GATEWAY_PID
```

**Document results** in a new file:

```bash
cat > /home/ray/miniAgent/BASELINE_METRICS.md << 'EOF'
# Phase 2 Baseline Metrics

**Date**: 2026-02-12
**Version**: 2026.2.10-miniAgent
**Runtime**: Bun (with Node.js APIs)

## Performance

- **Startup time**: [record average] ms
- **Memory (idle)**: [record value] MB
- **Gateway starts**: ✅ / ❌
- **Discord connects**: ✅ / ❌

## Autonomy (Pre-Migration)

- **Cron jobs**: [test and record]
- **Heartbeat**: [test and record]
- **Webhooks**: [test and record]

This baseline will be compared against post-migration metrics.
EOF
```

---

### Step 1: Define Runtime Boundary

**Clarify what runs where** before any code changes.

#### 1.1 Document Runtime Architecture

Create the compatibility matrix as a **living document**:

```bash
cat > /home/ray/miniAgent/BUN_COMPATIBILITY.md << 'EOF'
# Bun Compatibility Matrix

**Purpose**: Source of truth for what runs on Bun vs Node, and why.

**Status**: Phase 2 in progress

---

## Runtime Boundary

### Bun-Native Layer (MUST run on Bun with Bun APIs)

- **Gateway WebSocket** (`src/gateway/`) - High-frequency, always-on
- **Autonomy services** - Cron, heartbeat, webhooks
- **Session management** - Frequent file I/O
- **Memory persistence** - Frequent reads/writes

### Node-Compatible Layer (MAY use Node APIs or stay on Node)

- **Web UI** (Next.js) - Communicates with gateway over HTTP/WebSocket
- **TUI** (Ink/React) - May need Node if Bun breaks rendering
- **Infrequent utilities** - One-off scripts, maintenance tools

---

## Dependency Decisions

| Package | Type | Bun Status | Decision | Rationale |
|---------|------|------------|----------|-----------|
| @anthropic-ai/sdk | API | ✅ Works | Keep as-is | No migration needed |
| discord.js | Messaging | ✅ Works | Keep as-is | No migration needed |
| ws | WebSocket | 🔄 Migrate | Replace with Bun.serve | Hot path, high impact |
| better-sqlite3 | Database | ⚠️ Evaluate | TBD (see decision tree) | Need to test Bun.sqlite features |
| tslog | Logging | ✅ Works | Keep as-is | No migration needed |

**Legend**:
- ✅ Works: Compatible with Bun, no changes needed
- 🔄 Migrate: High-value migration target
- ⚠️ Evaluate: Needs testing before decision
- ❌ Incompatible: Must find alternative or keep on Node

---

## Hybrid Runtime Story

**If hybrid mode is used** (some components on Node, some on Bun):

### Layout

```

miniAgent/
├── Gateway (Bun process)
│ └─ bun src/index.ts gateway
│ - WebSocket server
│ - Cron scheduler
│ - Heartbeat runner
│ - Discord integration
│
└── Web UI (Node process, optional)
└─ node web/start.js - Next.js panel - Communicates with gateway via WebSocket/HTTP

```

### Communication

- Web UI connects to Gateway at `ws://localhost:18789`
- All state lives in Gateway
- Web UI is stateless, read-only view

### Rules

- ❌ NO direct imports of Node-only modules in `src/gateway/` or `src/autonomy/`
- ✅ OK to use Node in `src/web/` or `src/ui/`
- ✅ All cross-boundary communication via HTTP/WebSocket

---

## Testing Log

As we test each dependency, record results here:

### @anthropic-ai/sdk
- **Tested**: [date]
- **Result**: ✅ Works
- **Notes**: No issues, keep as-is

### discord.js
- **Tested**: [date]
- **Result**: ✅ Works
- **Notes**: No issues, Discord integration stable

### ws → Bun.serve
- **Tested**: [date]
- **Result**: [pending]
- **Notes**: [to be added]

[Continue for each dependency...]

---

**Last Updated**: 2026-02-12
EOF
```

#### 1.2 Test Current Functionality

Verify baseline works:

```bash
cd /home/ray/miniAgent

# Basic startup
bun src/index.ts --version

# Gateway
bun src/index.ts gateway &
GATEWAY_PID=$!
sleep 30
ps -p $GATEWAY_PID && echo "✅ Gateway running" || echo "❌ Gateway crashed"
kill $GATEWAY_PID
```

---

### Step 2: Identify Migration Targets

Find the code that will benefit most from Bun APIs.

#### 2.1 Find WebSocket Server (Priority 1)

```bash
# Locate WebSocket implementation
grep -r "new.*WebSocket\.Server\|ws\.Server\|WebSocketServer" src/gateway/ --include="*.ts"

# Find handlers
grep -r "\.on\('connection'\)\|\.on\('message'\)" src/gateway/ --include="*.ts" -l
```

**Document findings** in BUN_COMPATIBILITY.md:

```bash
echo "### WebSocket Server Files" >> BUN_COMPATIBILITY.md
echo "" >> BUN_COMPATIBILITY.md
echo "Files to migrate:" >> BUN_COMPATIBILITY.md
# Add files you found
```

#### 2.2 Find File I/O Hot Paths (Priority 2)

```bash
# Focus on frequent file operations
grep -r "fs\.readFile\|fs\.writeFile\|readFileSync\|writeFileSync" src/ --include="*.ts" | \
  grep -E "(session|memory|cron)" | head -20
```

**Document findings**:

```bash
echo "### File I/O Hot Paths" >> BUN_COMPATIBILITY.md
echo "" >> BUN_COMPATIBILITY.md
echo "- Session: [files]" >> BUN_COMPATIBILITY.md
echo "- Memory: [files]" >> BUN_COMPATIBILITY.md
echo "- Cron: [files]" >> BUN_COMPATIBILITY.md
```

#### 2.3 Find SQLite Usage (Priority 3 - Optional)

```bash
# Find SQLite database code
grep -r "Database\|sqlite" src/ --include="*.ts" -l | grep -v node_modules
```

**Important**: SQLite migration is **optional**. See decision tree in Step 5.

#### 2.4 Find HTTP Endpoints (Priority 4)

```bash
# Find webhook/HTTP endpoints
grep -r "express\|fastify\|app\.post\|app\.get" src/ --include="*.ts" | \
  grep -E "(webhook|hook|http)" | head -20
```

---

### Step 3: Slice A - WebSocket Migration (Highest Priority)

**Goal**: Replace `ws` package with `Bun.serve` WebSocket

**Why first**: WebSocket is the core of the gateway, highest performance impact

**Conservative approach**: Maintain exact same message formats and behavior

#### 3.1 Create Feature Branch

```bash
cd /home/ray/miniAgent
git checkout -b bun-websocket
```

#### 3.2 Locate Current Implementation

Based on Step 2.1 findings, read the WebSocket server file:

```bash
# Find main gateway file
grep -r "WebSocket.*Server" src/gateway/ --include="*.ts" -l

# Read current implementation
# Identify:
# - Where server is created
# - How connections are handled
# - How messages are sent/received
# - Any message transformation logic
```

#### 3.3 Create Bun WebSocket Implementation

**Pattern**: Preserve existing message handling logic, only change the server layer.

**Abstraction Strategy** (recommended):

Create a small `GatewaySocket` interface to decouple Bun-specific types:

```typescript
// src/gateway/socket-interface.ts
export interface GatewaySocket {
  id: string;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  data: Record<string, any>; // Connection metadata
}

export interface GatewaySocketServer {
  broadcast(data: string | Buffer): void;
  close(): void;
}
```

Then implement with Bun:

```typescript
// src/gateway/server-bun.ts
import { serve, type ServerWebSocket } from "bun";
import type { GatewaySocket, GatewaySocketServer } from "./socket-interface.js";

interface WebSocketData {
  clientId: string;
  // Add your connection metadata
}

export function createBunGatewayServer(port: number): GatewaySocketServer {
  const clients = new Set<ServerWebSocket<WebSocketData>>();

  const server = serve<WebSocketData>({
    port,

    websocket: {
      open(ws) {
        clients.add(ws);
        console.log("WebSocket connected:", ws.data.clientId);
        // Call existing connection handler
        handleConnection(wrapSocket(ws));
      },

      message(ws, message) {
        const data = typeof message === "string" ? message : Buffer.from(message).toString();
        // Call existing message handler
        handleMessage(wrapSocket(ws), data);
      },

      close(ws, code, reason) {
        clients.delete(ws);
        console.log("WebSocket closed:", ws.data.clientId);
        // Call existing close handler
        handleClose(wrapSocket(ws));
      },

      drain(ws) {
        // Handle backpressure if needed
      },
    },

    fetch(req, server) {
      const url = new URL(req.url);

      // Upgrade to WebSocket
      if (url.pathname === "/gateway") {
        const upgraded = server.upgrade(req, {
          data: {
            clientId: crypto.randomUUID(),
          },
        });
        if (upgraded) return;
      }

      // Non-WebSocket requests
      return new Response("miniAgent Gateway", { status: 200 });
    },
  });

  function wrapSocket(ws: ServerWebSocket<WebSocketData>): GatewaySocket {
    return {
      id: ws.data.clientId,
      send: (data) => ws.send(data),
      close: (code, reason) => ws.close(code, reason),
      data: ws.data,
    };
  }

  return {
    broadcast: (data) => {
      clients.forEach((ws) => ws.send(data));
    },
    close: () => {
      server.stop();
    },
  };
}

// Import your existing handlers
function handleConnection(socket: GatewaySocket) {
  /* ... */
}
function handleMessage(socket: GatewaySocket, data: string) {
  /* ... */
}
function handleClose(socket: GatewaySocket) {
  /* ... */
}
```

**Key principles**:

- **Maintain message formats**: No changes to JSON structures
- **Preserve behavior**: Same connection lifecycle
- **Add backpressure handling**: Use `drain` if needed
- **Keep same port**: Don't change configuration

#### 3.4 Test WebSocket Migration

```bash
# Start gateway with new implementation
bun src/index.ts gateway &
GATEWAY_PID=$!

# In another terminal, test connection
npm install -g wscat  # If not installed
wscat -c ws://localhost:18789/gateway

# Send test messages
> {"type": "ping"}
# Verify response

# Test Discord connection (manually in Discord)
# Send a message, verify bot responds

# Cleanup
kill $GATEWAY_PID
```

#### 3.5 Test Autonomy SLOs

**Critical**: Verify autonomy features still work:

```bash
# Test cron (if configured)
# Check logs for scheduled job execution times
# Verify <60s skew from expected time

# Test heartbeat (if configured)
# Check logs for heartbeat intervals
# Verify ±10% of configured period

# Test webhooks
curl -X POST http://localhost:[webhook-port]/hooks/wake \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Verify response <1s
```

#### 3.6 Benchmark Performance

```bash
# Startup time
time bun src/index.ts --version

# Memory
bun src/index.ts gateway &
PID=$!
sleep 30
ps -p $PID -o rss= | awk '{print $1/1024 "MB"}'
kill $PID
```

**Document in BUN_COMPATIBILITY.md**:

```bash
cat >> BUN_COMPATIBILITY.md << 'EOF'

## Migration Results

### WebSocket (Bun.serve)
- **Before**: [startup time], [memory]
- **After**: [startup time], [memory]
- **Tests**: ✅ All passing
- **SLOs**: ✅ Maintained
EOF
```

#### 3.7 Commit

```bash
git add -A
git commit -m "feat(gateway): migrate WebSocket to Bun.serve

- Replaced ws package with Bun native WebSocket
- Maintained message formats and behavior
- All autonomy SLOs preserved

Performance:
- Startup: [time]ms (baseline: [baseline]ms)
- Memory: [value]MB (baseline: [baseline]MB)
- SLO tests: ✅ passing"
```

---

### Step 4: Slice B - File I/O Migration (Priority 2)

**Goal**: Migrate frequent file operations to `Bun.file` / `Bun.write`

**Scope**: Session state, memory persistence, cron state (hot paths only)

**Conservative approach**: Only migrate high-frequency operations

#### 4.1 Create Feature Branch

```bash
git checkout ray-edition  # Back to main branch
git checkout -b bun-file-io
```

#### 4.2 Identify File I/O to Migrate

Prioritize by frequency:

1. **Session loading/saving** - Every message
2. **Memory persistence** - Frequent updates
3. **Cron state** - Less frequent (optional to migrate)

Find the files:

```bash
grep -r "fs\." src/session/ src/memory/ --include="*.ts" -l
```

#### 4.3 Create FileStore Abstraction (Optional)

**If code uses fs directly everywhere**, create an abstraction:

```typescript
// src/infra/file-store.ts
export class FileStore {
  async readText(path: string): Promise<string> {
    const file = Bun.file(path);
    return await file.text();
  }

  async readJSON<T>(path: string): Promise<T> {
    const content = await this.readText(path);
    return JSON.parse(content);
  }

  async writeText(path: string, data: string): Promise<void> {
    await Bun.write(path, data);
  }

  async writeJSON(path: string, data: any): Promise<void> {
    await Bun.write(path, JSON.stringify(data, null, 2));
  }

  async exists(path: string): Promise<boolean> {
    const file = Bun.file(path);
    return await file.exists();
  }
}

export const fileStore = new FileStore();
```

**If code already has abstractions**, just change the implementation underneath.

#### 4.4 Migrate Session Files

**Example** (adjust to actual code structure):

**Before**:

```typescript
import fs from "fs/promises";

async function loadSession(id: string) {
  const content = await fs.readFile(`sessions/${id}.json`, "utf-8");
  return JSON.parse(content);
}

async function saveSession(id: string, data: any) {
  await fs.writeFile(`sessions/${id}.json`, JSON.stringify(data, null, 2));
}
```

**After**:

```typescript
async function loadSession(id: string) {
  const file = Bun.file(`sessions/${id}.json`);
  const content = await file.text();
  return JSON.parse(content);
}

async function saveSession(id: string, data: any) {
  await Bun.write(`sessions/${id}.json`, JSON.stringify(data, null, 2));
}
```

**Or with abstraction**:

```typescript
import { fileStore } from "../infra/file-store.js";

async function loadSession(id: string) {
  return await fileStore.readJSON(`sessions/${id}.json`);
}

async function saveSession(id: string, data: any) {
  await fileStore.writeJSON(`sessions/${id}.json`, data);
}
```

#### 4.5 Test File I/O

**Functional test**:

```bash
# Start gateway
bun src/index.ts gateway &
GATEWAY_PID=$!

# Run a conversation (manually or via script)
# Verify:
# - Session files are created
# - Session state persists across restarts
# - No file corruption

# Restart gateway
kill $GATEWAY_PID
bun src/index.ts gateway &
GATEWAY_PID=$!

# Verify session restored
# Cleanup
kill $GATEWAY_PID
```

**Benchmark** (if measurable):

```bash
# Create benchmark script for session I/O
cat > benchmark-file-io.ts << 'EOF'
const iterations = 1000;
const testData = { session: "test", messages: ["a", "b", "c"] };

console.time("File I/O (Bun)");
for (let i = 0; i < iterations; i++) {
  await Bun.write(`/tmp/session-${i}.json`, JSON.stringify(testData));
  const file = Bun.file(`/tmp/session-${i}.json`);
  await file.text();
}
console.timeEnd("File I/O (Bun)");

// Cleanup
await Promise.all(
  Array.from({ length: iterations }, (_, i) =>
    import("fs/promises").then(fs => fs.unlink(`/tmp/session-${i}.json`))
  )
);
EOF

bun benchmark-file-io.ts
```

#### 4.6 Commit

```bash
git add -A
git commit -m "feat(session): migrate file I/O to Bun.file API

- Migrated session and memory file operations
- Used Bun.file/Bun.write for hot paths
- All tests passing

Performance: [add metrics if measurable]"
```

---

### Step 5: Slice C - SQLite Migration (OPTIONAL)

**IMPORTANT**: This migration is **optional** and should only be done if:

1. Bun.sqlite supports all features you need (FTS, extensions, etc.)
2. Testing shows no performance regression
3. Migration provides measurable benefit

**Conservative approach**: If uncertain, **skip this step** and keep `better-sqlite3`.

#### 5.1 Decision Tree

```
Do you use full-text search (FTS)?
├─ YES → Test if Bun.sqlite supports FTS
│  ├─ Works well → Proceed with migration
│  └─ Doesn't work/slow → KEEP better-sqlite3
│
└─ NO → Proceed with testing

Do you use SQLite extensions?
├─ YES → Test if Bun.sqlite supports them
│  ├─ Works → Proceed
│  └─ Doesn't work → KEEP better-sqlite3
│
└─ NO → Proceed with testing

Run performance benchmark (see below)
├─ Bun.sqlite faster/same → Migrate
└─ Bun.sqlite slower → KEEP better-sqlite3

Any uncertainty?
└─ KEEP better-sqlite3 (it works with Bun!)
```

#### 5.2 Test Bun.sqlite Features

```bash
cat > test-bun-sqlite.ts << 'EOF'
import { Database } from "bun:sqlite";

// Create test database
const db = new Database(":memory:");

// Test 1: Basic operations
db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
db.run("INSERT INTO test (value) VALUES (?)", ["test1"]);
const query = db.query("SELECT * FROM test");
console.log("✅ Basic operations:", query.all());

// Test 2: FTS (if you use it)
try {
  db.run("CREATE VIRTUAL TABLE fts USING fts5(content)");
  db.run("INSERT INTO fts VALUES ('hello world')");
  const ftsQuery = db.query("SELECT * FROM fts WHERE fts MATCH 'hello'");
  console.log("✅ FTS works:", ftsQuery.all());
} catch (e) {
  console.log("❌ FTS not supported:", e.message);
}

// Test 3: Prepared statements
const insert = db.prepare("INSERT INTO test (value) VALUES (?)");
insert.run("test2");
console.log("✅ Prepared statements work");

db.close();
EOF

bun test-bun-sqlite.ts
```

**If FTS or other features don't work**: STOP. Keep `better-sqlite3`. Document this decision in BUN_COMPATIBILITY.md.

#### 5.3 Benchmark SQLite

**Only if features test passed**:

```bash
cat > benchmark-sqlite.ts << 'EOF'
import { Database as BunDb } from "bun:sqlite";
import BetterSqlite3 from "better-sqlite3";

const iterations = 10000;

// Bun.sqlite
console.time("Bun.sqlite");
const bunDb = new BunDb(":memory:");
bunDb.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
const bunInsert = bunDb.prepare("INSERT INTO test (value) VALUES (?)");
for (let i = 0; i < iterations; i++) {
  bunInsert.run(`value-${i}`);
}
const bunQuery = bunDb.query("SELECT COUNT(*) as count FROM test");
console.log("Bun result:", bunQuery.get());
console.timeEnd("Bun.sqlite");

// better-sqlite3
console.time("better-sqlite3");
const betterDb = new BetterSqlite3(":memory:");
betterDb.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
const betterInsert = betterDb.prepare("INSERT INTO test (value) VALUES (?)");
for (let i = 0; i < iterations; i++) {
  betterInsert.run(`value-${i}`);
}
const betterQuery = betterDb.prepare("SELECT COUNT(*) as count FROM test");
console.log("Better result:", betterQuery.get());
console.timeEnd("better-sqlite3");
EOF

bun benchmark-sqlite.ts
```

**Decision**:

- If Bun.sqlite is **significantly faster** (>20%) → Migrate
- If Bun.sqlite is **similar** → Your choice (slight preference to migrate for fewer deps)
- If Bun.sqlite is **slower** → Keep better-sqlite3

#### 5.4 Migrate (Only if Decision is "Migrate")

**Pattern**:

**Before** (better-sqlite3):

```typescript
import Database from "better-sqlite3";

const db = new Database("memory.db");
const stmt = db.prepare("SELECT * FROM memories WHERE id = ?");
const result = stmt.get(id);
```

**After** (Bun.sqlite):

```typescript
import { Database } from "bun:sqlite";

const db = new Database("memory.db");
const stmt = db.query("SELECT * FROM memories WHERE id = ?");
const result = stmt.get(id);
```

**Key differences**:

- Import from `bun:sqlite`
- `db.prepare()` → `db.query()` (but both have `.get()`, `.all()`, `.run()`)

#### 5.5 Test Memory System

```bash
# Start gateway
bun src/index.ts gateway

# Test memory operations:
# - Store memories
# - Query/search memories
# - Verify results match expectations
# - Check for errors in logs
```

#### 5.6 Document Decision

**If migrated**:

```bash
cat >> BUN_COMPATIBILITY.md << 'EOF'

### SQLite (Bun.sqlite)
- **Decision**: Migrated to Bun.sqlite
- **Rationale**: FTS works, performance equal/better, fewer deps
- **Tests**: ✅ All memory operations passing
EOF
```

**If kept better-sqlite3**:

```bash
cat >> BUN_COMPATIBILITY.md << 'EOF'

### SQLite (better-sqlite3)
- **Decision**: Keep better-sqlite3
- **Rationale**: [FTS support needed / Performance regression / Feature gaps]
- **Status**: Works well with Bun, no migration needed
EOF
```

#### 5.7 Commit (if migrated)

```bash
git add -A
git commit -m "feat(memory): migrate to Bun.sqlite

- Replaced better-sqlite3 with Bun native SQLite
- All memory tests passing
- Performance: [add metrics]"
```

**Or commit decision to skip**:

```bash
git add BUN_COMPATIBILITY.md
git commit -m "docs: document SQLite decision

Keeping better-sqlite3:
- [reason: FTS / performance / features]
- Works well with Bun, no migration needed"
```

---

### Step 6: Slice D - HTTP/Webhooks Migration (Priority 4)

**Goal**: Replace Express/Fastify with `Bun.serve` for webhook endpoints

**Scope**: Only webhook and HTTP endpoints used by autonomy/external triggers

#### 6.1 Create Feature Branch

```bash
git checkout ray-edition
git checkout -b bun-webhooks
```

#### 6.2 Find HTTP Endpoints

```bash
grep -r "express\|fastify\|app\.post\|app\.get" src/ --include="*.ts" | \
  grep -E "(webhook|hook|http)"
```

#### 6.3 Migrate to Bun.serve

**Pattern**:

**Before** (Express):

```typescript
import express from "express";

const app = express();
app.use(express.json());

app.post("/hooks/wake", (req, res) => {
  console.log("Wake hook:", req.body);
  res.json({ status: "ok" });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.listen(3001, () => console.log("Webhooks on 3001"));
```

**After** (Bun.serve):

```typescript
import { serve } from "bun";

const server = serve({
  port: 3001,

  async fetch(req) {
    const url = new URL(req.url);

    // Wake webhook
    if (url.pathname === "/hooks/wake" && req.method === "POST") {
      const body = await req.json();
      console.log("Wake hook:", body);
      return Response.json({ status: "ok" });
    }

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json({ status: "healthy" });
    }

    // 404
    return new Response("Not found", { status: 404 });
  },
});

console.log("Webhooks on", server.port);
```

**Consider**: You may want to co-locate HTTP and WebSocket in a single `Bun.serve` instance:

```typescript
const server = serve({
  port: 18789,

  websocket: {
    // ... WebSocket handlers from Step 3
  },

  fetch(req, server) {
    const url = new URL(req.url);

    // Try WebSocket upgrade first
    if (url.pathname === "/gateway") {
      if (server.upgrade(req, { data: { clientId: crypto.randomUUID() } })) {
        return; // Upgraded
      }
    }

    // HTTP endpoints
    if (url.pathname === "/hooks/wake" && req.method === "POST") {
      // ... webhook handler
    }

    return new Response("Not found", { status: 404 });
  },
});
```

#### 6.4 Test Webhooks

```bash
# Start gateway
bun src/index.ts gateway &
GATEWAY_PID=$!

# Test wake endpoint
curl -X POST http://localhost:3001/hooks/wake \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}' \
  -w "\nTime: %{time_total}s\n"

# Should return: {"status":"ok"}
# Should be <1s

# Test health check
curl http://localhost:3001/health

# Cleanup
kill $GATEWAY_PID
```

#### 6.5 Verify SLOs

```bash
# Webhook latency test
for i in {1..100}; do
  curl -X POST http://localhost:3001/hooks/wake \
    -H "Content-Type: application/json" \
    -d '{"test": true}' \
    -w "%{time_total}\n" \
    -o /dev/null -s
done | awk '{total+=$1; count++} END {print "Average:", total/count "s"}'

# Should be <1s on average
```

#### 6.6 Commit

```bash
git add -A
git commit -m "feat(webhooks): migrate HTTP server to Bun.serve

- Replaced Express/Fastify with Bun native HTTP
- All webhook endpoints functional
- SLO: p95 latency <1s ✅"
```

---

### Step 7: Performance Benchmarking

After all migrations, measure improvements.

#### 7.1 Startup Time Benchmark

```bash
cat > benchmark-startup.sh << 'EOF'
#!/bin/bash

echo "Benchmarking startup time..."

runs=10
total=0

for i in $(seq 1 $runs); do
  start=$(date +%s%N)
  timeout 5 bun src/index.ts --version > /dev/null 2>&1
  end=$(date +%s%N)

  elapsed=$(( (end - start) / 1000000 ))
  total=$(( total + elapsed ))
  echo "Run $i: ${elapsed}ms"
done

average=$(( total / runs ))
echo ""
echo "Average startup: ${average}ms"
echo "Target: <1000ms"

if [ $average -lt 1000 ]; then
  echo "✅ Target achieved!"
else
  echo "⚠️  Above target (${average}ms > 1000ms)"
fi
EOF

chmod +x benchmark-startup.sh
./benchmark-startup.sh
```

#### 7.2 Memory Usage Benchmark

```bash
cat > benchmark-memory.sh << 'EOF'
#!/bin/bash

echo "Benchmarking memory usage..."

bun src/index.ts gateway > /dev/null 2>&1 &
PID=$!

echo "Gateway PID: $PID"
echo "Stabilizing (10s)..."
sleep 10

echo ""
echo "Sampling memory (30s)..."
max_mem=0
for i in $(seq 1 30); do
  mem=$(ps -p $PID -o rss= 2>/dev/null | awk '{print int($1/1024)}')
  if [ -z "$mem" ]; then
    echo "❌ Process died!"
    exit 1
  fi
  [ $mem -gt $max_mem ] && max_mem=$mem
  echo "Sample $i: ${mem}MB (peak: ${max_mem}MB)"
  sleep 1
done

echo ""
echo "Peak memory: ${max_mem}MB"
echo "Target: <300MB"

if [ $max_mem -lt 300 ]; then
  echo "✅ Target achieved!"
else
  echo "⚠️  Above target (${max_mem}MB > 300MB)"
fi

kill $PID 2>/dev/null
EOF

chmod +x benchmark-memory.sh
./benchmark-memory.sh
```

#### 7.3 Document Results

Update BUN_COMPATIBILITY.md or create BENCHMARKS.md:

```bash
cat > BENCHMARKS.md << 'EOF'
# Phase 2 Performance Benchmarks

**Date**: [date]
**Version**: 2026.2.10-miniAgent
**Branch**: [current branch]

## Startup Time

| Metric | Baseline (Node APIs) | After Migration (Bun APIs) | Improvement |
|--------|---------------------|----------------------------|-------------|
| Average | [X]ms | [Y]ms | [Z]% |
| Target | - | <1000ms | ✅ / ❌ |

## Memory Usage

| Metric | Baseline | After Migration | Improvement |
|--------|----------|-----------------|-------------|
| Idle | [X]MB | [Y]MB | [Z]% |
| Peak (30s) | [X]MB | [Y]MB | [Z]% |
| Target | - | <300MB | ✅ / ❌ |

## Autonomy SLOs

| SLO | Target | Result | Status |
|-----|--------|--------|--------|
| Cron skew | <60s | [value] | ✅ / ❌ |
| Heartbeat drift | ±10% | [value] | ✅ / ❌ |
| Webhook latency | p95 <1s | [value] | ✅ / ❌ |

## Migration Summary

- **WebSocket**: ✅ Migrated to Bun.serve
- **File I/O**: ✅ Migrated to Bun.file
- **SQLite**: ✅ Migrated / ❌ Kept better-sqlite3 (reason: ...)
- **HTTP**: ✅ Migrated to Bun.serve

EOF
```

---

### Step 8: Integration Testing

Verify everything works together.

#### 8.1 Full System Test

```bash
# Start gateway
bun src/index.ts gateway

# Manual checklist:
# - [ ] Gateway starts successfully
# - [ ] WebSocket connections work
# - [ ] Discord bot connects
# - [ ] Can send/receive messages
# - [ ] Memory system works (store/retrieve)
# - [ ] Cron jobs execute on schedule
# - [ ] Heartbeat runs at correct interval
# - [ ] Webhooks respond
# - [ ] Files persist correctly
```

#### 8.2 24-Hour Stability Test (Optional but Recommended)

```bash
# Start gateway
bun src/index.ts gateway > gateway.log 2>&1 &
GATEWAY_PID=$!

echo "Gateway running (PID: $GATEWAY_PID)"
echo "Monitoring for 24 hours..."
echo "Check logs: tail -f gateway.log"
echo "Check memory: watch -n 60 'ps -p $GATEWAY_PID -o rss='"

# After 24 hours:
# - Verify no crashes
# - Check memory hasn't grown excessively
# - Verify autonomy features still working
# - Review logs for errors
```

#### 8.3 Load Test (Optional)

```bash
# WebSocket load test
npm install -g wscat

# Connect 50 clients
for i in {1..50}; do
  wscat -c ws://localhost:18789/gateway > /dev/null 2>&1 &
done

# Monitor memory
ps -p $(pgrep -f "bun src/index.ts") -o rss= | awk '{print $1/1024 "MB"}'

# Cleanup
pkill wscat
```

---

### Step 9: Merge and Finalize

#### 9.1 Merge Feature Branches

```bash
# Merge all slices back to main branch
git checkout ray-edition

# Merge in order
git merge bun-websocket
git merge bun-file-io
# If you migrated SQLite:
git merge bun-sqlite
git merge bun-webhooks

# Or if you worked on one combined branch:
git merge bun-migration
```

#### 9.2 Update Documentation

Update CHECKLIST.md to mark Phase 2 complete:

```bash
# Mark Phase 2 tasks complete
# Update with actual performance metrics
```

Update START_HERE.md:

```bash
# Update "Current Status" section
# Document Phase 2 completion
# Add performance improvements
```

#### 9.3 Final Commit

```bash
git add -A
git commit -m "feat: complete Phase 2 Bun migration

Phase 2 Complete - Bun Native APIs Migration

Migrations:
- ✅ WebSocket: ws package → Bun.serve
- ✅ File I/O: fs/promises → Bun.file/Bun.write
- [✅/❌] SQLite: [migrated to Bun.sqlite / kept better-sqlite3]
- ✅ HTTP: [Express/Fastify] → Bun.serve

Performance Improvements:
- Startup: [X]ms → [Y]ms ([Z]% improvement)
- Memory: [X]MB → [Y]MB ([Z]% improvement)

Autonomy SLOs:
- Cron skew: ✅ <60s
- Heartbeat drift: ✅ ±10%
- Webhook latency: ✅ p95 <1s

All tests passing ✅
Documentation updated ✅
Ready for Phase 3"
```

---

## Rollback Strategy

If any migration causes issues:

### Rollback Single Slice

```bash
# If WebSocket migration fails
git revert <commit-hash-of-websocket-migration>

# Or restore specific file
git checkout ray-edition -- src/gateway/server.impl.ts

# Test
bun src/index.ts gateway
```

### Rollback Entire Phase 2

```bash
# Nuclear option: undo all Phase 2 work
git checkout ray-edition
git branch -D bun-websocket bun-file-io bun-sqlite bun-webhooks

# Start over if needed
git checkout -b bun-migration-v2
```

### Hybrid Approach

**If some migrations work but others don't**:

1. **Keep what works**: WebSocket and file I/O likely safe
2. **Revert what doesn't**: SQLite or HTTP if problematic
3. **Document hybrid state**: Update BUN_COMPATIBILITY.md

Example hybrid state:

- ✅ WebSocket: Bun.serve
- ✅ File I/O: Bun.file
- ❌ SQLite: better-sqlite3 (Bun.sqlite lacked FTS)
- ✅ HTTP: Bun.serve

This is **acceptable** and still provides significant benefit.

---

## Troubleshooting

### Issue: Bun.sqlite missing features

**Solution**: Keep better-sqlite3. It works perfectly with Bun.

```bash
# Verify better-sqlite3 works
bun -e "import('better-sqlite3').then(() => console.log('✅ Works!'))"
```

Document in BUN_COMPATIBILITY.md:

```markdown
### SQLite Decision

- **Status**: Keeping better-sqlite3
- **Reason**: Bun.sqlite lacks [FTS/extensions/feature]
- **Works with Bun**: ✅ Yes, no migration needed
```

### Issue: WebSocket clients can't connect

**Debug steps**:

```bash
# 1. Check what's listening
lsof -i :18789

# 2. Test with curl (should get upgrade response)
curl -v http://localhost:18789/gateway

# 3. Check gateway logs
bun src/index.ts gateway --verbose

# 4. Test with simple client
wscat -c ws://localhost:18789/gateway
```

**Common causes**:

- Port mismatch (check config)
- Upgrade logic not triggering
- Path mismatch (`/gateway` vs `/`)

### Issue: Memory usage higher than expected

**Debug**:

```bash
# Profile with Bun inspector
bun --inspect src/index.ts gateway

# Open Chrome DevTools at chrome://inspect
# Take heap snapshot
```

**Common causes**:

- Session history not cleaned up (check session TTL)
- Embedding cache too large (check memory config)
- Event listener leaks (check WebSocket handlers)

**Solutions**:

- Add session cleanup logic
- Limit embedding cache size
- Use weak references where appropriate

### Issue: Autonomy features broken

**Symptoms**:

- Cron jobs not firing
- Heartbeat stopped
- Webhooks not responding

**Debug**:

```bash
# Check logs for errors
tail -f gateway.log | grep -E "cron|heartbeat|webhook"

# Verify services started
ps aux | grep bun

# Check for unhandled promises
# Add to gateway startup:
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
```

**Solutions**:

- Verify timers/intervals migrated correctly
- Check for async handler errors
- Ensure event loop not blocked

### Issue: Discord bot disconnects

**Debug**:

```bash
# Check Discord.js logs
# Verify WebSocket stays open
# Check for rate limiting

# Test connection stability
bun src/index.ts gateway &
PID=$!

# Monitor for 10 minutes
for i in {1..600}; do
  if ! ps -p $PID > /dev/null; then
    echo "Gateway crashed at ${i}s!"
    break
  fi
  sleep 1
done
```

**Common causes**:

- WebSocket keep-alive not working
- Backpressure not handled (use `drain`)
- Message size limits exceeded

---

## Success Criteria

Phase 2 is **complete** when ALL of these are true:

### Performance Targets

- [x] Startup time <1 second
- [x] Memory baseline <300MB idle
- [x] No performance regression vs baseline

### Autonomy SLOs

- [x] Cron skew: 95% of jobs within 60s of schedule
- [x] Heartbeat drift: ±10% of configured interval
- [x] Webhook latency: p95 <1s

### Functional Requirements

- [x] Gateway starts without errors
- [x] WebSocket connections work
- [x] Discord bot connects and responds
- [x] Memory system functional (store/retrieve)
- [x] All Phase 1 features still work

### Documentation

- [x] BUN_COMPATIBILITY.md complete with rationale
- [x] BENCHMARKS.md has performance metrics
- [x] Migration decisions documented
- [x] Hybrid runtime story (if applicable) documented

### Stability

- [x] No crashes during testing
- [x] 24-hour uptime test passed (optional but recommended)
- [x] All tests passing

---

## Next Steps After Phase 2

Once all success criteria met:

1. **Phase 3**: Config simplification (.env-based setup)
2. **Phase 4**: Testing and optimization for VPS deployment

**Don't proceed to Phase 3 until Phase 2 is fully stable and documented.**

---

## Quick Reference

- [CHECKLIST.md](CHECKLIST.md) - Complete task checklist
- [START_HERE.md](START_HERE.md) - Project overview
- [BUN_COMPATIBILITY.md](BUN_COMPATIBILITY.md) - Dependency decisions (created in Step 1)
- [BENCHMARKS.md](BENCHMARKS.md) - Performance metrics (created in Step 7)
