# Target Project Structure

This shows what your miniAgent directory should look like when fully implemented.

```
miniAgent/
│
├── 📄 Documentation (already created)
│   ├── README.md                      # Project overview
│   ├── ARCHITECTURE_ANALYSIS.md       # OpenClaw analysis
│   ├── MINIMAL_DESIGN.md              # Design specifications
│   ├── QUICK_START.md                 # Implementation guide
│   ├── CHECKLIST.md                   # Progress tracking
│   └── PROJECT_STRUCTURE.md           # This file
│
├── 📁 Configuration
│   ├── .env                           # Environment variables (create this)
│   │   # ANTHROPIC_API_KEY=sk-ant-...
│   │   # DEFAULT_MODEL=claude-3-5-sonnet-20241022
│   │   # WORKSPACE_DIR=.
│   │   # WEB_PORT=3000
│   ├── .gitignore                     # Ignore node_modules, .env, etc.
│   ├── package.json                   # Bun dependencies
│   ├── tsconfig.json                  # TypeScript config
│   └── bun.lockb                      # Lock file (auto-generated)
│
├── 📁 Source Code (you will create these)
│   └── src/
│       ├── config.ts                  # Load environment variables
│       ├── sessions.ts                # Session CRUD operations
│       ├── tools.ts                   # Tool implementations
│       ├── subscribe.ts               # Event subscription (extract from OpenClaw)
│       ├── agent.ts                   # Main agent orchestrator
│       ├── cli.ts                     # CLI interface for testing
│       ├── tui.tsx                    # TUI client (Phase 2)
│       ├── server.ts                  # WebSocket server (Phase 3)
│       └── discord.ts                 # Discord adapter (Phase 5, optional)
│
├── 📁 Web Panel (you will create this)
│   └── web/
│       ├── package.json               # Web deps (separate from main)
│       ├── vite.config.ts             # Vite configuration
│       ├── index.html                 # Entry HTML
│       └── src/
│           ├── main.tsx               # React entry point
│           ├── app.tsx                # Main app component
│           ├── hooks/
│           │   └── use-agent.ts       # WebSocket connection hook
│           ├── components/
│           │   ├── chat.tsx           # Chat interface
│           │   ├── session-list.tsx   # Session sidebar
│           │   └── settings.tsx       # Settings panel
│           └── styles/
│               └── app.css            # Global styles
│
├── 📁 Runtime Data (auto-generated)
│   ├── .miniagent/
│   │   └── sessions/                  # Session JSON files
│   │       ├── abc-123-xyz.json       # Example session
│   │       └── def-456-uvw.json       # Another session
│   └── logs/
│       └── miniagent.log              # Application logs (optional)
│
└── 📁 Build Output (auto-generated)
    └── dist/
        ├── index.js                   # Bundled server (production)
        └── web/                       # Bundled web panel (production)
            ├── index.html
            ├── assets/
            └── ...
```

---

## File Sizes (Estimated)

### Documentation (already created)

```
README.md                    ~3 KB
ARCHITECTURE_ANALYSIS.md    ~45 KB
MINIMAL_DESIGN.md           ~35 KB
QUICK_START.md              ~15 KB
CHECKLIST.md                ~12 KB
PROJECT_STRUCTURE.md         ~5 KB
──────────────────────────────────
Total Documentation:       ~115 KB ✅
```

### Source Code (to be created)

```
src/config.ts                ~1 KB   (simple)
src/sessions.ts              ~3 KB   (straightforward)
src/tools.ts                 ~8 KB   (6 tools)
src/subscribe.ts            ~15 KB   (complex - extract from OpenClaw)
src/agent.ts                ~12 KB   (core orchestration)
src/cli.ts                   ~2 KB   (simple CLI)
src/tui.tsx                  ~8 KB   (Phase 2)
src/server.ts                ~5 KB   (Phase 3)
src/discord.ts               ~6 KB   (Phase 5, optional)
──────────────────────────────────
Total Source:               ~60 KB
```

### Web Panel (to be created)

```
web/src/app.tsx              ~4 KB
web/src/hooks/use-agent.ts   ~5 KB
web/src/components/chat.tsx  ~8 KB
web/src/components/...       ~6 KB
──────────────────────────────────
Total Web Source:           ~25 KB
```

### Dependencies

```
node_modules/               ~50 MB  (bun is efficient)
web/node_modules/           ~30 MB  (React + Vite)
──────────────────────────────────
Total Dependencies:         ~80 MB
```

### Runtime Data

```
Sessions:                 variable  (grows over time)
Logs:                     variable  (with rotation)
```

---

## Comparison with OpenClaw

```
OpenClaw:
├── Source code:          ~500 KB+
├── Dependencies:         ~300 MB
├── Runtime memory:       ~300 MB
└── Startup time:         2-3 seconds

miniAgent:
├── Source code:          ~60 KB (custom) + ~25 KB (web)
├── Dependencies:         ~80 MB
├── Runtime memory:       ~180 MB
└── Startup time:         < 500ms
```

**Reduction**: ~70% less dependencies, ~40% less memory, ~80% faster startup

---

## Key Directories to Create First

**Phase 1 (Core Agent)**:

```bash
mkdir -p src
mkdir -p .miniagent/sessions
touch src/config.ts
touch src/sessions.ts
touch src/tools.ts
touch src/subscribe.ts
touch src/agent.ts
touch src/cli.ts
```

**Phase 2 (TUI)**:

```bash
touch src/tui.tsx
```

**Phase 3 (Web Panel)**:

```bash
mkdir -p web/src/components
mkdir -p web/src/hooks
mkdir -p web/src/styles
touch src/server.ts
touch web/vite.config.ts
touch web/index.html
touch web/src/main.tsx
touch web/src/app.tsx
# etc...
```

---

## OpenClaw Files to Reference During Implementation

When implementing each file, refer to these OpenClaw files:

### For `src/config.ts`:

```
/home/ray/openclaw/src/config/
/home/ray/openclaw/src/auth/
```

Look for environment variable loading and basic config.

### For `src/sessions.ts`:

```
/home/ray/openclaw/src/session/
```

But note: SessionManager is in the SDK, you just need CRUD wrappers.

### For `src/tools.ts`: ⭐ CRITICAL

```
/home/ray/openclaw/src/agents/pi-tools.ts
```

This file contains all tool definitions. Extract bash, read, write, web-fetch, glob, grep.

### For `src/subscribe.ts`: ⭐ CRITICAL + COMPLEX

```
/home/ray/openclaw/src/agents/pi-embedded-subscribe.ts
/home/ray/openclaw/src/agents/pi-embedded-subscribe.handlers.ts
/home/ray/openclaw/src/agents/pi-embedded-subscribe.handlers.lifecycle.ts
/home/ray/openclaw/src/agents/pi-embedded-subscribe.handlers.messages.ts
/home/ray/openclaw/src/agents/pi-embedded-subscribe.handlers.tools.ts
```

These files handle SDK events and streaming. Study carefully!

### For `src/agent.ts`: ⭐ CRITICAL + COMPLEX

```
/home/ray/openclaw/src/agents/pi-embedded-runner/run/attempt.ts
/home/ray/openclaw/src/agents/pi-embedded-runner/run.ts
```

This is the main orchestrator. The heart of the agent.

### For `src/server.ts`:

```
/home/ray/openclaw/src/gateway/
/home/ray/openclaw/src/daemon/
```

For understanding RPC patterns (but you'll use WebSocket, not Unix socket).

### For `src/discord.ts` (optional):

```
/home/ray/openclaw/src/channels/discord/
```

Discord adapter pattern.

---

## How to Use This Structure

1. **Start with documentation** (✅ already done)
   - Read ARCHITECTURE_ANALYSIS.md
   - Read MINIMAL_DESIGN.md
   - Keep QUICK_START.md open

2. **Create directory structure**

   ```bash
   cd /home/ray/miniAgent
   mkdir -p src .miniagent/sessions
   ```

3. **Initialize project**

   ```bash
   bun init -y
   bun add @mariozechner/pi-coding-agent @anthropic-ai/sdk
   ```

4. **Create files one by one** (follow CHECKLIST.md)
   - Start with `src/config.ts` (easiest)
   - Then `src/sessions.ts`
   - Then `src/tools.ts` (reference OpenClaw)
   - Then `src/subscribe.ts` (hardest, study OpenClaw carefully)
   - Then `src/agent.ts` (integrate everything)
   - Finally `src/cli.ts` (test it all)

5. **Test incrementally**
   - After each file, consider how to test it
   - Don't wait until everything is done
   - Use `console.log()` liberally

6. **Track progress**
   - Check off items in CHECKLIST.md
   - Add notes about issues/solutions

---

## Next Steps

1. ✅ Documentation is complete
2. ⏭️ **Start Phase 1**: Follow QUICK_START.md
3. ⏭️ Reference OpenClaw files as you implement
4. ⏭️ Use CHECKLIST.md to track progress

---

**Ready to code?** Open QUICK_START.md and begin! 🚀
