# Bun Compatibility Matrix

**Purpose**: Source of truth for what runs on Bun vs Node, and why.

**Status**: Phase 2 in progress

**Last Updated**: 2026-02-12

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

| Package           | Type      | Bun Status  | Decision                | Rationale                        |
| ----------------- | --------- | ----------- | ----------------------- | -------------------------------- |
| @anthropic-ai/sdk | API       | ✅ Works    | Keep as-is              | No migration needed              |
| discord.js        | Messaging | ✅ Works    | Keep as-is              | No migration needed              |
| ws                | WebSocket | 🔄 Migrate  | Replace with Bun.serve  | Hot path, high impact            |
| better-sqlite3    | Database  | ⚠️ Evaluate | TBD (see decision tree) | Need to test Bun.sqlite features |
| tslog             | Logging   | ✅ Works    | Keep as-is              | No migration needed              |
| express/fastify   | HTTP      | 🔄 Migrate  | Replace with Bun.serve  | Hot path for webhooks            |
| fs/promises       | File I/O  | 🔄 Migrate  | Replace with Bun.file   | Hot paths (sessions, memory)     |

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
│   └─ bun src/index.ts gateway
│      - WebSocket server
│      - Cron scheduler
│      - Heartbeat runner
│      - Discord integration
│
└── Web UI (Node process, optional)
    └─ node web/start.js
       - Next.js panel
       - Communicates with gateway via WebSocket/HTTP
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

## Migration Targets

### Priority 1: WebSocket Server

**Status**: Identified, ready for migration

**Current**: `ws` package (Node-style WebSocket)

**Target**: `Bun.serve` with native WebSocket support

**Files to migrate**:

- `src/gateway/server-runtime-state.ts` - WebSocketServer creation (line 166)
- `src/gateway/server-http.ts` - HTTP server with upgrade handler
- `src/gateway/server-ws-runtime.ts` - WebSocket runtime handling
- `src/gateway/server/ws-connection.ts` - Connection handler (line 61)
- `src/gateway/server/ws-connection/message-handler.ts` - Message handling
- `src/gateway/server/ws-types.ts` - WebSocket type definitions
- `src/gateway/server-broadcast.ts` - Broadcasting utilities

**Rationale**: WebSocket is the core of the gateway, highest performance impact

### Priority 2: File I/O

**Status**: Identified, ready for migration

**Current**: `fs/promises` (Node.js file APIs)

**Target**: `Bun.file` / `Bun.write`

**Hot paths**:

- Session loading/saving (every message)
- Memory persistence (frequent updates)
- Cron state (less frequent, optional)

**Files to migrate**:

- `src/auto-reply/reply/session.ts` - Session file writes (line 87)
- `src/agents/pi-embedded-runner/session-manager-init.ts` - Session initialization
- `src/agents/session-file-repair.ts` - Session file reads/repair
- `src/hooks/bundled/session-memory/handler.ts` - Session and memory file operations (lines 30, 173)

**Rationale**: High-frequency file operations in session and memory management

### Priority 3: SQLite (Optional)

**Status**: Identified, evaluation needed

**Current**: `node:sqlite` (DatabaseSync) - NOT better-sqlite3!

**Target**: `Bun.sqlite` (if features match)

**Decision criteria**:

- FTS (full-text search) support needed?
- Extension support needed?
- Performance comparison

**Files to evaluate**:

- `src/memory/sync-memory-files.ts` - Memory file synchronization
- `src/memory/qmd-manager.ts` - QMD manager
- `src/memory/sqlite-vec.ts` - Vector search
- `src/memory/manager-search.ts` - Memory search
- `src/memory/memory-schema.ts` - Schema definitions
- `src/memory/manager.ts` - Main memory manager
- `src/memory/sync-session-files.ts` - Session file sync

**Important Note**: Codebase already uses `node:sqlite` (Node's built-in DatabaseSync), NOT `better-sqlite3`. Need to evaluate Bun.sqlite vs node:sqlite compatibility.

**Rationale**: Optional - only if Bun.sqlite provides clear benefits over node:sqlite

### Priority 4: HTTP/Webhooks

**Status**: Identified, ready for migration

**Current**: Express (confirmed)

**Target**: `Bun.serve` HTTP handlers (can combine with WebSocket server)

**Files to migrate**:

- `src/media/server.ts` - Express-based media server (lines 35-89, 96-100)
- `src/commands/chutes-oauth.ts` - OAuth server (line 109)

**Note**: The main gateway already uses `node:http` with WebSocket upgrade, not Express for core functionality. Express is only used for media server.

**Rationale**: Simplify media serving, potential to combine with WebSocket server in single Bun.serve instance

---

## Testing Log

As we test each dependency, record results here:

### @anthropic-ai/sdk

- **Tested**: Not yet
- **Result**: TBD
- **Notes**: Assumed compatible, will verify

### discord.js

- **Tested**: ✅ 2026-02-12 (baseline testing)
- **Result**: ✅ Works
- **Notes**: Discord bot connects successfully, no issues observed

### ws → Bun.serve

- **Tested**: Not yet
- **Result**: Pending
- **Notes**: Will migrate in Priority 1

### better-sqlite3 / Bun.sqlite

- **Tested**: Not yet
- **Result**: Pending
- **Notes**: Will evaluate feature parity first

### fs/promises → Bun.file

- **Tested**: Not yet
- **Result**: Pending
- **Notes**: Will migrate hot paths only

### HTTP (Express/Fastify) → Bun.serve

- **Tested**: Not yet
- **Result**: Pending
- **Notes**: Will migrate webhook endpoints

---

## Migration Results

### WebSocket (Bun.serve)

- **Status**: Not started
- **Before**: [startup time], [memory]
- **After**: [startup time], [memory]
- **Tests**: Pending
- **SLOs**: Pending

### File I/O (Bun.file)

- **Status**: ✅ Complete
- **Before**: 1675ms startup, 308MB memory
- **After**: 1583ms startup, 310MB memory
- **Improvement**: 5.5% faster startup
- **Tests**: ✅ Passing - Gateway functional

**Files migrated**:

- src/hooks/bundled/session-memory/handler.ts
- src/agents/session-file-repair.ts
- src/agents/pi-embedded-runner/session-manager-init.ts

### SQLite

- **Status**: ✅ Evaluated - Keeping node:sqlite
- **Decision**: KEEP node:sqlite (DatabaseSync)
- **Rationale**:
  - Bun.sqlite has full feature parity (FTS5 ✅, extensions ✅, vec0 ✅)
  - Performance is excellent (11.93ms for 10k inserts with transaction)
  - However, node:sqlite already works perfectly under Bun via createRequire()
  - API differences would require changes across multiple files
  - Conservative approach: Don't migrate what's not broken
    -No compelling performance benefit to justify migration risk

**Test Results**:

- Bun.sqlite FTS5: ✅ Working
- Bun.sqlite extension loading: ✅ Working (sqlite-vec loaded successfully)
- Bun.sqlite vector search: ✅ Working (vec0 table created)
- Performance: 23.58ms (no transaction), 11.93ms (with transaction) for 10k inserts

**Notes**:

- Current implementation uses `requireNodeSqlite()` wrapper with createRequire()
- This works seamlessly under Bun
- Future consideration: Could migrate to Bun.sqlite if API standardization is desired

### HTTP/Webhooks (Bun.serve)

- **Status**: Not started
- **Before**: [latency metrics]
- **After**: [latency metrics]
- **Tests**: Pending

---

## Next Steps

1. **Identify WebSocket files** - Find all `ws` usage in gateway
2. **Identify File I/O hot paths** - Locate session/memory file operations
3. **Evaluate SQLite** - Test Bun.sqlite feature parity
4. **Identify HTTP endpoints** - Find webhook/HTTP server code
5. **Begin migrations** - Start with WebSocket (Priority 1)

---

**Notes**:

- This document will be updated as we make migration decisions
- All decisions should be based on testing, not assumptions
- Conservative approach: keep what works, migrate only what provides clear benefits
- Autonomy stability is more important than API purity
