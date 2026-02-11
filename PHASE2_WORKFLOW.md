# Phase 2: Bun Migration Workflow

**Goal**: Migrate miniAgent from Node.js APIs to Bun APIs for optimal performance on 1GB RAM VPS

**Status**: Ready to begin

**Prerequisites**: Phase 1 complete, miniAgent functional with Node.js runtime

---

## Overview

Phase 2 is the **major performance optimization work** for miniAgent. While the codebase currently runs with Bun as a runtime (`bun src/index.ts`), it still uses Node.js APIs internally (fs, ws package, better-sqlite3, etc.). This phase migrates hot paths to native Bun APIs for significantly better performance.

### Expected Benefits

- **Startup time**: <1 second (from ~3-5 seconds)
- **Memory baseline**: <300MB (from ~500MB+)
- **Hot path performance**: 2-3x faster file I/O, WebSocket handling
- **Built-in features**: Leverages Bun's native SQLite, HTTP server, file APIs

---

## Migration Strategy

**Approach**: Incremental migration, starting with hot paths

**Key principle**: Migrate what matters most first. Don't migrate everything—focus on performance-critical code.

**Testing**: Test after each migration step, keep working version in git

---

## Step-by-Step Workflow

### Step 1: Dependency Compatibility Audit

Before migrating any code, verify which dependencies work with Bun.

#### 1.1 Test Current Functionality

```bash
cd /home/ray/miniAgent

# Verify everything works with Bun runtime
bun src/index.ts --version
bun src/index.ts gateway &
GATEWAY_PID=$!

# Let it run for 30 seconds
sleep 30

# Check if it's still running
ps -p $GATEWAY_PID

# Stop it
kill $GATEWAY_PID
```

**Expected**: Gateway starts and runs without errors.

#### 1.2 Create Dependency Compatibility Matrix

Create a file to track compatibility:

```bash
# Create tracking file
cat > /home/ray/miniAgent/BUN_COMPATIBILITY.md << 'EOF'
# Bun Compatibility Matrix

## Core Dependencies

| Package | Type | Status | Action | Notes |
|---------|------|--------|--------|-------|
| @mariozechner/pi-coding-agent | Core | ✅ Works | Keep | Tested, no issues |
| @anthropic-ai/sdk | API | ✅ Works | Keep | Tested, no issues |
| discord.js | Messaging | ? | Test | Discord integration |
| better-sqlite3 | Database | ? | Migrate to Bun.sqlite | Native module |
| ws | WebSocket | ? | Migrate to Bun.serve | Core hot path |
| tslog | Logging | ? | Test | May work as-is |

## Tested Dependencies

- [ ] @mariozechner/pi-coding-agent
- [ ] @anthropic-ai/sdk
- [ ] discord.js
- [ ] better-sqlite3
- [ ] ws
- [ ] tslog

## Migration Decisions

Document decisions as you test...
EOF
```

#### 1.3 Test Each Critical Dependency

Test the most important packages:

```bash
# Test basic imports
bun -e "import('@anthropic-ai/sdk').then(() => console.log('✅ Anthropic SDK works'))"
bun -e "import('discord.js').then(() => console.log('✅ Discord.js works'))"
bun -e "import('ws').then(() => console.log('✅ ws works'))"
```

Update BUN_COMPATIBILITY.md as you test.

---

### Step 2: Identify Hot Paths

Find the code that runs most frequently—these are migration priorities.

#### 2.1 Find WebSocket Server Code

```bash
cd /home/ray/miniAgent

# Find WebSocket implementation
grep -r "new.*WebSocket\.Server\|ws\.Server\|WebSocketServer" src/gateway/ --include="*.ts"

# Find WebSocket handlers
grep -r "\.on\('connection'\)\|\.on\('message'\)" src/gateway/ --include="*.ts"
```

**Expected files**: Likely `src/gateway/server*.ts` or `src/gateway/websocket*.ts`

**Document findings**:

```bash
echo "## WebSocket Hot Paths" >> BUN_COMPATIBILITY.md
echo "" >> BUN_COMPATIBILITY.md
echo "Files to migrate:" >> BUN_COMPATIBILITY.md
# Add the files you found
```

#### 2.2 Find File I/O Hot Paths

```bash
# Find frequent file operations
grep -r "fs\.readFile\|fs\.writeFile\|readFileSync\|writeFileSync" src/ --include="*.ts" | \
  grep -E "(session|memory|cron|state)" | head -20

# Focus on these directories
grep -r "fs\." src/session/ src/memory/ src/cron/ --include="*.ts" -l
```

**Expected**: Session management, memory persistence, cron job storage

**Document findings**:

```bash
echo "" >> BUN_COMPATIBILITY.md
echo "## File I/O Hot Paths" >> BUN_COMPATIBILITY.md
echo "" >> BUN_COMPATIBILITY.md
echo "Files to migrate:" >> BUN_COMPATIBILITY.md
# Add the files you found
```

#### 2.3 Find SQLite Usage

```bash
# Find SQLite database usage
grep -r "Database\|sqlite" src/ --include="*.ts" -l | grep -v node_modules
```

**Expected**: Likely in `src/memory/` for vector search/embeddings

**Document findings**:

```bash
echo "" >> BUN_COMPATIBILITY.md
echo "## SQLite Hot Paths" >> BUN_COMPATIBILITY.md
echo "" >> BUN_COMPATIBILITY.md
echo "Files to migrate:" >> BUN_COMPATIBILITY.md
# Add the files you found
```

#### 2.4 Find HTTP Server Code

```bash
# Find HTTP/webhook endpoints
grep -r "express\|fastify\|app\.post\|app\.get\|router" src/ --include="*.ts" | \
  grep -E "(webhook|hook|http)" | head -20
```

**Expected**: Webhook endpoints for wake calls, external integrations

---

### Step 3: Migrate WebSocket Server (Priority 1)

This is the **highest priority** migration—the gateway WebSocket is the core of OpenClaw.

#### 3.1 Create Feature Branch

```bash
cd /home/ray/miniAgent
git checkout -b bun-websocket-migration
```

#### 3.2 Locate Current WebSocket Implementation

Based on Step 2.1 findings, read the WebSocket server file:

```bash
# Example (adjust based on actual file)
bun src/index.ts gateway --help  # See what starts the gateway
grep -r "createServer\|WebSocket" src/gateway/ --include="*.ts" -A 3
```

Identify:

- Where WebSocket server is created
- How connections are handled
- How messages are sent/received

#### 3.3 Create Bun WebSocket Implementation

**Pattern**: Create new file alongside existing implementation

Example (adjust file names based on your findings):

```bash
# If current implementation is in src/gateway/server-impl.ts
# Create src/gateway/server-impl-bun.ts

# Read current implementation first
# Then create Bun version
```

**Bun WebSocket API Pattern**:

```typescript
import { serve, type ServerWebSocket } from "bun";

interface WebSocketData {
  clientId: string;
  // Add your connection metadata
}

const server = serve<WebSocketData>({
  port: 18789,

  websocket: {
    open(ws) {
      console.log("WebSocket connected:", ws.data.clientId);
      // Initialize connection
    },

    message(ws, message) {
      // Handle incoming messages
      const data = typeof message === "string" ? message : Buffer.from(message).toString();
      console.log("Received:", data);

      // Process message
      // Send response
      ws.send(JSON.stringify({ response: "ok" }));
    },

    close(ws, code, reason) {
      console.log("WebSocket closed:", ws.data.clientId, code, reason);
      // Cleanup connection
    },

    drain(ws) {
      // Called when write buffer is empty (backpressure handling)
    },
  },

  fetch(req, server) {
    // Upgrade HTTP requests to WebSocket
    const url = new URL(req.url);

    if (url.pathname === "/gateway") {
      const upgraded = server.upgrade(req, {
        data: {
          clientId: crypto.randomUUID(),
          // Add connection metadata
        },
      });

      if (upgraded) return; // Upgrade successful
    }

    // Return HTTP response for non-WebSocket requests
    return new Response("miniAgent Gateway", { status: 200 });
  },
});

console.log(`Gateway listening on port ${server.port}`);
```

#### 3.4 Test WebSocket Migration

```bash
# Start gateway with new implementation
bun src/index.ts gateway

# In another terminal, test connection
npm install -g wscat  # If not installed
wscat -c ws://localhost:18789/gateway

# Send test message
> {"type": "ping"}

# Verify response
```

#### 3.5 Benchmark Performance

```bash
# Before (Node.js ws package) - if you saved the old version
time node src/index.ts --version

# After (Bun native WebSocket)
time bun src/index.ts --version

# Memory usage
bun src/index.ts gateway &
PID=$!
ps -p $PID -o rss= | awk '{print $1/1024 "MB"}'
kill $PID
```

**Document results** in BUN_COMPATIBILITY.md

#### 3.6 Commit WebSocket Migration

```bash
git add -A
git commit -m "feat(gateway): migrate WebSocket server to Bun.serve

- Replaced ws package with native Bun WebSocket API
- Performance: [add metrics]
- Memory: [add metrics]
- All tests passing"
```

---

### Step 4: Migrate File I/O (Priority 2)

Focus on frequently-accessed files (session data, memory, cron jobs).

#### 4.1 Identify File I/O to Migrate

Based on Step 2.2 findings, prioritize:

1. Session loading/saving (happens every message)
2. Memory persistence (happens frequently)
3. Cron job state (less frequent, lower priority)

#### 4.2 Create Migration Pattern

**Before (Node.js)**:

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

**After (Bun)**:

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

#### 4.3 Migrate One File at a Time

```bash
# Example: Migrate session manager
# 1. Read current implementation
cat src/session/manager.ts  # Or whatever file handles sessions

# 2. Create feature branch
git checkout -b bun-file-io-migration

# 3. Edit file, replace fs calls with Bun.file/Bun.write
# Use your editor

# 4. Test
bun src/index.ts gateway
# Verify sessions still work

# 5. Commit
git add src/session/manager.ts
git commit -m "feat(session): migrate file I/O to Bun.file API"
```

#### 4.4 Benchmark File I/O

```bash
# Create benchmark script
cat > benchmark-file-io.ts << 'EOF'
const iterations = 1000;
const testData = { test: "data", timestamp: Date.now() };

// Bun.write
console.time("Bun.write");
for (let i = 0; i < iterations; i++) {
  await Bun.write(`/tmp/test-${i}.json`, JSON.stringify(testData));
}
console.timeEnd("Bun.write");

// Clean up
await Promise.all(
  Array.from({ length: iterations }, (_, i) =>
    Bun.write(`/tmp/test-${i}.json`, "").then(() =>
      import("fs/promises").then(fs => fs.unlink(`/tmp/test-${i}.json`))
    )
  )
);
EOF

bun benchmark-file-io.ts
```

**Document results** in BUN_COMPATIBILITY.md

---

### Step 5: Migrate SQLite (Priority 3)

Replace better-sqlite3 with Bun's built-in SQLite.

#### 5.1 Find Current SQLite Usage

```bash
# Find current implementation
grep -r "better-sqlite3\|new Database" src/memory/ --include="*.ts" -A 5
```

#### 5.2 Test Bun.sqlite Compatibility

```bash
# Create test script
cat > test-bun-sqlite.ts << 'EOF'
import { Database } from "bun:sqlite";

// Create test database
const db = new Database(":memory:");

// Create table
db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

// Insert data
db.run("INSERT INTO test (value) VALUES (?)", ["test1"]);
db.run("INSERT INTO test (value) VALUES (?)", ["test2"]);

// Query data
const query = db.query("SELECT * FROM test");
const results = query.all();
console.log("Results:", results);

// Prepared statements
const insert = db.prepare("INSERT INTO test (value) VALUES (?)");
insert.run("test3");

// Verify
console.log("All rows:", db.query("SELECT * FROM test").all());

db.close();
console.log("✅ Bun.sqlite works!");
EOF

bun test-bun-sqlite.ts
```

#### 5.3 Migrate Memory Database

**Pattern**:

**Before (better-sqlite3)**:

```typescript
import Database from "better-sqlite3";

const db = new Database("memory.db");
const stmt = db.prepare("SELECT * FROM memories WHERE id = ?");
const result = stmt.get(id);
```

**After (Bun.sqlite)**:

```typescript
import { Database } from "bun:sqlite";

const db = new Database("memory.db");
const stmt = db.query("SELECT * FROM memories WHERE id = ?");
const result = stmt.get(id);
```

**Key differences**:

- Import from `bun:sqlite` not `better-sqlite3`
- `db.prepare()` → `db.query()`
- `.get()`, `.all()`, `.run()` methods similar

#### 5.4 Test Memory System

```bash
# Start gateway
bun src/index.ts gateway

# Test memory storage (via Discord or CLI)
# Verify memories are stored and retrieved correctly
```

#### 5.5 Commit SQLite Migration

```bash
git add -A
git commit -m "feat(memory): migrate to Bun native SQLite

- Replaced better-sqlite3 with Bun.sqlite
- Performance: [add metrics]
- All memory tests passing"
```

---

### Step 6: Migrate HTTP Server (Priority 4)

Replace Express/Fastify with Bun.serve for webhooks.

#### 6.1 Find HTTP Endpoints

```bash
# Find webhook/HTTP code
grep -r "express\|fastify\|app\.\|router\." src/ --include="*.ts" | grep -E "(post|get|listen)"
```

#### 6.2 Migrate to Bun.serve

**Pattern**:

**Before (Express)**:

```typescript
import express from "express";

const app = express();
app.use(express.json());

app.post("/hooks/wake", (req, res) => {
  console.log("Wake hook called:", req.body);
  res.json({ status: "ok" });
});

app.listen(3001, () => console.log("Webhooks on port 3001"));
```

**After (Bun.serve)**:

```typescript
import { serve } from "bun";

const server = serve({
  port: 3001,

  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/hooks/wake" && req.method === "POST") {
      const body = await req.json();
      console.log("Wake hook called:", body);
      return Response.json({ status: "ok" });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("Webhooks on port", server.port);
```

#### 6.3 Test Webhooks

```bash
# Start server
bun src/index.ts gateway &

# Test webhook
curl -X POST http://localhost:3001/hooks/wake \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Should return: {"status":"ok"}
```

---

### Step 7: Performance Benchmarking

After all migrations, benchmark the improvements.

#### 7.1 Benchmark Startup Time

```bash
# Create benchmark script
cat > benchmark-startup.sh << 'EOF'
#!/bin/bash

echo "Benchmarking startup time..."

# Run 10 times and average
total=0
runs=10

for i in $(seq 1 $runs); do
  start=$(date +%s%N)
  timeout 5 bun src/index.ts --version > /dev/null 2>&1
  end=$(date +%s%N)

  elapsed=$(( (end - start) / 1000000 ))  # Convert to milliseconds
  total=$(( total + elapsed ))
  echo "Run $i: ${elapsed}ms"
done

average=$(( total / runs ))
echo ""
echo "Average startup time: ${average}ms"
echo "Target: <1000ms"

if [ $average -lt 1000 ]; then
  echo "✅ Target achieved!"
else
  echo "❌ Target not met ($average ms > 1000ms)"
fi
EOF

chmod +x benchmark-startup.sh
./benchmark-startup.sh
```

#### 7.2 Benchmark Memory Usage

```bash
# Create memory benchmark
cat > benchmark-memory.sh << 'EOF'
#!/bin/bash

echo "Benchmarking memory usage..."

# Start gateway
bun src/index.ts gateway > /dev/null 2>&1 &
PID=$!

echo "Gateway PID: $PID"
echo "Waiting 10 seconds for stabilization..."
sleep 10

# Sample memory every second for 30 seconds
echo ""
echo "Sampling memory (30 seconds)..."
for i in $(seq 1 30); do
  mem=$(ps -p $PID -o rss= 2>/dev/null | awk '{print int($1/1024)}')
  if [ -z "$mem" ]; then
    echo "Process died!"
    exit 1
  fi
  echo "Sample $i: ${mem}MB"
  sleep 1
done

# Final measurement
final_mem=$(ps -p $PID -o rss= | awk '{print int($1/1024)}')
echo ""
echo "Final memory: ${final_mem}MB"
echo "Target: <300MB"

if [ $final_mem -lt 300 ]; then
  echo "✅ Target achieved!"
else
  echo "⚠️  Above target (${final_mem}MB > 300MB)"
fi

# Cleanup
kill $PID 2>/dev/null
EOF

chmod +x benchmark-memory.sh
./benchmark-memory.sh
```

#### 7.3 Document Results

Update BUN_COMPATIBILITY.md with final results:

```bash
cat >> BUN_COMPATIBILITY.md << 'EOF'

## Performance Results

### Startup Time
- Before: X ms (Node.js APIs)
- After: Y ms (Bun APIs)
- Improvement: Z%

### Memory Usage
- Before: X MB
- After: Y MB
- Improvement: Z%

### WebSocket Throughput
- Messages/sec: X
- Latency p95: Y ms

## Migration Complete ✅

All hot paths migrated to Bun native APIs.
EOF
```

---

### Step 8: Integration Testing

Verify everything works together.

#### 8.1 Full System Test

```bash
# Start gateway
bun src/index.ts gateway

# Checklist:
# - [ ] Gateway starts successfully
# - [ ] WebSocket connections work
# - [ ] Discord bot connects
# - [ ] Messages send/receive
# - [ ] Memory system works
# - [ ] Cron jobs execute
# - [ ] Webhooks respond
# - [ ] File persistence works
```

#### 8.2 Load Test (Optional)

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

### Step 9: Merge and Document

#### 9.1 Merge All Feature Branches

```bash
# Merge all migration branches
git checkout ray-edition
git merge bun-websocket-migration
git merge bun-file-io-migration
# ... merge other branches

# Or if you worked on one branch:
git checkout ray-edition
git merge bun-migration  # Whatever your branch name was
```

#### 9.2 Update Documentation

Update CHECKLIST.md:

```bash
# Mark Phase 2 tasks as complete
# Update with actual performance metrics
```

Update START_HERE.md:

```bash
# Add Phase 2 completion
# Document performance improvements
```

#### 9.3 Final Commit

```bash
git add -A
git commit -m "feat: complete Phase 2 Bun migration

Phase 2 Complete - Bun API Migration
- Migrated WebSocket server to Bun.serve
- Migrated file I/O to Bun.file API
- Migrated SQLite to Bun.sqlite
- Migrated HTTP server to Bun.serve

Performance Improvements:
- Startup: <1s (previously ~3-5s)
- Memory: <300MB baseline (previously ~500MB)
- WebSocket: [metrics]
- File I/O: [metrics]

All tests passing ✅"
```

---

## Rollback Strategy

If any migration causes issues:

### Rollback Single Migration

```bash
# If WebSocket migration fails
git revert <commit-hash>
git checkout <old-file> src/gateway/server-impl.ts

# Test
bun src/index.ts gateway
```

### Rollback Entire Phase

```bash
# Nuclear option: start Phase 2 over
git checkout ray-edition
git branch -D bun-migration  # Delete failed branch
git checkout -b bun-migration-v2  # Start fresh
```

### Hybrid Approach

If some migrations work but others don't:

1. **Keep what works**: WebSocket and file I/O likely to work
2. **Defer what doesn't**: SQLite might need better-sqlite3 if Bun.sqlite lacks features
3. **Document hybrid**: Note in BUN_COMPATIBILITY.md what uses Node.js vs Bun APIs

---

## Troubleshooting

### Issue: Bun.sqlite missing features

**Solution**: Keep better-sqlite3, it works with Bun

```bash
# Test better-sqlite3 with Bun
bun -e "import('better-sqlite3').then(() => console.log('Works!'))"
```

### Issue: WebSocket clients can't connect

**Debug**:

```bash
# Check what's listening
lsof -i :18789

# Test with curl
curl http://localhost:18789

# Check gateway logs
bun src/index.ts gateway --verbose
```

### Issue: Memory usage higher than expected

**Debug**:

```bash
# Profile with Bun inspector
bun --inspect src/index.ts gateway

# Open Chrome DevTools
# chrome://inspect
```

**Common causes**:

- Session history not being cleaned up
- Embedding cache too large
- Memory leaks in event handlers

---

## Success Criteria

Phase 2 is complete when:

- [x] Gateway runs on Bun runtime with native APIs
- [x] Startup time <1 second
- [x] Memory baseline <300MB
- [x] All Phase 1 features still work (Discord, skills, etc.)
- [x] Performance benchmarks documented
- [x] No regressions in functionality

---

## Next Steps

After Phase 2:

1. **Phase 3**: Config simplification (.env-based setup)
2. **Phase 4**: Testing and optimization for VPS deployment

---

**Quick Reference**:

- [CHECKLIST.md](CHECKLIST.md) - Complete task checklist
- [START_HERE.md](START_HERE.md) - Project overview
- [BUN_COMPATIBILITY.md](BUN_COMPATIBILITY.md) - Dependency tracking (created in Step 1)
