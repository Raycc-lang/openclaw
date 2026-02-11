# miniAgent: Complete Planning Summary

**Status**: Architecture planning complete (revised with autonomy + memory)
**Date**: 2026-02-11
**Next Step**: Choose architecture option and begin implementation

---

## WHAT CHANGED FROM INITIAL PLAN

### ❌ Version 1.0 (Incomplete)

I initially designed a **reactive chatbot**:

- User sends message → Agent responds
- No autonomy (no cron, no heartbeat, no webhooks)
- No memory system
- Just UI → Agent → LLM

**This was WRONG.** It missed the entire point of OpenClaw.

### ✅ Version 2.0 (Complete)

The revised design is an **autonomous agent platform**:

- **Cron**: Scheduled tasks ("daily briefing at 7 AM")
- **Heartbeat**: Background awareness (checks every 30 min)
- **Hooks/Webhooks**: External triggers (Gmail → agent)
- **System Events**: Context injection (async signals)
- **Memory**: Long-term recall (vector search over markdown)

**This is what OpenClaw actually is.**

---

## DOCUMENTATION ROADMAP

Read these files in order:

### 1. **ARCHITECTURE_ANALYSIS_REVISED.md** (READ FIRST)

- Complete OpenClaw architecture breakdown
- All 7 sections covering autonomy + memory
- Understanding of how cron/heartbeat/hooks/memory work
- Critical for informed decisions

### 2. **MINIMAL_DESIGN_REVISED.md** (READ SECOND)

- Your miniAgent architecture options (A/B/C/D)
- Component specifications with code examples
- Memory optimization targets
- Implementation phases
- Recommended: Option A (full autonomy)

### 3. **PROJECT_STRUCTURE.md** (Reference)

- Target file organization
- OpenClaw file mappings
- Size estimates

### 4. **QUICK_START.md** (Outdated - ignore for now)

- Based on v1.0 (reactive only)
- Will need revision after you choose option

### 5. **CHECKLIST.md** (Will update)

- Progress tracking
- Needs revision for autonomy phases

---

## DECISION MATRIX: WHICH OPTION?

### Option A: Full Autonomy ⭐ **RECOMMENDED**

**What you get**:

```
✅ Cron service (scheduled tasks)
✅ Heartbeat runner (periodic awareness)
✅ Hooks/webhooks (external triggers)
✅ Memory system (vector search)
✅ TUI + Web Panel
⚠️ Optional: Discord
```

**Memory**: ~275MB running (fits 1GB VPS comfortably)

**Use cases**:

- "Remind me about meeting tomorrow at 9 AM" → cron creates reminder
- "Check my email every 30 minutes" → heartbeat monitors inbox
- Gmail sends webhook → agent processes new email
- "What did we decide about the API design?" → memory_search recalls

**Complexity**: High (6-8 weeks)

**Why recommended**:

1. Still fits 1GB VPS (~725MB headroom)
2. Actually autonomous (not just a chatbot)
3. Bun optimizations offset memory cost
4. This is WHY you use OpenClaw vs ChatGPT web

---

### Option B: Background Awareness Only

**What you get**:

```
❌ Cron service
✅ Heartbeat runner
⚠️ Simplified hooks (wake only)
✅ Memory system
✅ TUI + Web Panel
```

**Memory**: ~230MB running

**Use cases**:

- Can't do "remind me at 3 PM" (no cron)
- Still checks periodically (heartbeat)
- Still has long-term memory
- Simpler webhooks (just notifications, not isolated runs)

**Complexity**: Medium (4-6 weeks)

**Why choose**:

- If you don't need precise scheduling
- If you want lighter weight
- If you primarily use memory + periodic checks

---

### Option C: Reactive with Memory

**What you get**:

```
❌ All autonomy (cron, heartbeat, hooks)
✅ Memory system
✅ TUI + Web Panel
```

**Memory**: ~210MB running

**Use cases**:

- Smart chatbot that remembers
- No background operation
- Only responds when you ask
- Like ChatGPT with memory

**Complexity**: Low-Medium (3-4 weeks)

**Why choose**:

- If you only want conversational assistant
- If you don't need autonomy
- If you value simplicity over capability
- **Warning**: Loses most of what makes OpenClaw special

---

### Option D: Pure Reactive (❌ Not Recommended)

**What you get**:

```
❌ All autonomy
❌ Memory
✅ TUI + Web Panel
```

**Memory**: ~180MB running

**Why NOT choose**:

- Just a basic chatbot
- Forgets everything across sessions
- No autonomy at all
- Might as well use ChatGPT web
- **Only choose if**: learning exercise or extreme constraints

---

## MEMORY BREAKDOWN (Full Autonomy - Option A)

| Component                    | Idle      | Running   | Notes            |
| ---------------------------- | --------- | --------- | ---------------- |
| Bun runtime                  | 50MB      | 50MB      | Base overhead    |
| Gateway (WebSocket+HTTP)     | 40MB      | 40MB      | Bun.serve        |
| **Cron service**             | 10MB      | 15MB      | Timer + jobs     |
| **Heartbeat runner**         | 10MB      | 15MB      | Timer + state    |
| **System event queue**       | 5MB       | 5MB       | In-memory        |
| **Memory index (SQLite)**    | 20MB      | 20MB      | Database         |
| **Memory embedding cache**   | 10MB      | 10MB      | Cached vectors   |
| Agent orchestrator           | 30MB      | 30MB      | SDK wrapper      |
| Pi-Coding-Agent SDK (idle)   | -         | -         | Lazy loaded      |
| Pi-Coding-Agent SDK (active) | -         | 100MB     | During execution |
| **Total**                    | **175MB** | **275MB** | ✅ Fits 1GB VPS  |

**Headroom**: 1024MB - 275MB = **749MB** for OS + other processes ✅

---

## COMPLEXITY COMPARISON

### Version 1.0 (Reactive)

```
Core Agent: ⭐⭐ (medium)
Total: ⭐⭐ (medium)
Time: 2-3 weeks
```

### Version 2.0 Option A (Full Autonomy)

```
Core Agent: ⭐⭐ (medium)
Cron Service: ⭐⭐⭐ (extract from OpenClaw)
Heartbeat: ⭐⭐ (extract from OpenClaw)
Hooks: ⭐ (simpler)
Memory: ⭐⭐⭐ (complex: SQLite + embeddings)
Total: ⭐⭐⭐⭐ (high)
Time: 6-8 weeks
```

**Is it worth it?** Yes, if you want actual autonomy.

---

## KEY FILES TO EXTRACT FROM OPENCLAW

### For Cron (Phase 2)

- `/home/ray/openclaw/src/cron/service/timer.ts` ⭐ Core timer loop
- `/home/ray/openclaw/src/cron/service/store.ts` - Persistence
- `/home/ray/openclaw/src/cron/service/ops.ts` - High-level operations

### For Heartbeat (Phase 2)

- `/home/ray/openclaw/src/infra/heartbeat-runner.ts` ⭐ Scheduler
- `/home/ray/openclaw/src/infra/heartbeat-wake.ts` - Coalescing logic
- `/home/ray/openclaw/src/auto-reply/reply/heartbeat.ts` - Execution

### For Memory (Phase 3)

- `/home/ray/openclaw/src/memory/manager.ts` ⭐ Index manager
- `/home/ray/openclaw/src/memory/memory-schema.ts` - SQLite schema
- `/home/ray/openclaw/src/agents/tools/memory-tool.ts` - Tool definitions
- `/home/ray/openclaw/src/memory/embed.ts` - Embedding providers

### For Agent Core (Phase 1)

- `/home/ray/openclaw/src/agents/pi-embedded-runner/run/attempt.ts` ⭐
- `/home/ray/openclaw/src/agents/pi-embedded-subscribe.ts` ⭐
- `/home/ray/openclaw/src/agents/pi-tools.ts` ⭐

---

## IMPLEMENTATION TIMELINE

### Option A (Full Autonomy) - 6-8 weeks

**Week 1-2: Phase 1 (Gateway + Agent Core)**

- Bun project setup
- WebSocket server (Bun.serve)
- HTTP server (webhooks)
- Agent orchestrator (extract from OpenClaw)
- Tool system
- Session management
- Basic RPC

**Week 2-3: Phase 2 (Autonomy)**

- Cron service (extract + adapt)
- Heartbeat runner (extract + adapt)
- System event queue (simple)
- Webhook handlers
- Integration testing

**Week 3-4: Phase 3 (Memory)**

- SQLite setup
- Embedding provider (OpenAI or local)
- Chunking + indexing
- Hybrid search (BM25 + vector)
- Memory tools
- System prompt integration

**Week 4: Phase 4 (TUI)**

- WebSocket client
- Terminal UI (ink or terminal-kit)
- Chat interface
- Streaming display

**Week 5-6: Phase 5 (Web Panel)**

- Vite + React
- WebSocket hook
- Chat component
- Cron management UI
- Memory search UI

**Week 6: Phase 6 (Polish)**

- Error handling
- Logging
- Documentation
- VPS deployment

---

## RECOMMENDED PATH FORWARD

### Step 1: Deep Study (Today - 1 day)

```bash
# Read complete architecture analysis
cat ARCHITECTURE_ANALYSIS_REVISED.md

# Read design options
cat MINIMAL_DESIGN_REVISED.md

# Study OpenClaw autonomy
cat /home/ray/openclaw/src/cron/service/timer.ts
cat /home/ray/openclaw/src/infra/heartbeat-runner.ts
cat /home/ray/openclaw/src/memory/manager.ts
```

### Step 2: Make Decision (Today)

Choose: Option A, B, C, or D

**My recommendation**: **Option A** (full autonomy)

- Fits your VPS
- Truly autonomous agent
- Worth the extra complexity
- This is what you came to OpenClaw for

### Step 3: Start Phase 1 (Tomorrow)

```bash
cd /home/ray/miniAgent
bun init -y
bun add @mariozechner/pi-coding-agent @anthropic-ai/sdk ws
mkdir -p src .miniagent/sessions .miniagent/cron
```

Follow MINIMAL_DESIGN_REVISED.md Phase 1 specifications.

### Step 4: Incremental Implementation

- Don't try to build everything at once
- Each phase is independently testable
- Phase 1 gives you working agent (no autonomy yet)
- Phase 2 adds autonomy
- Phase 3 adds memory
- Phase 4-5 add UIs

---

## QUESTIONS FOR YOU

Before starting, please answer:

1. **Which option do you choose?** (A/B/C/D)
   - My recommendation: A (full autonomy)

2. **Do you want Discord support?** (Yes/No/Later)
   - Can add in Phase 7 if yes

3. **TUI library preference?**
   - ink (prettier, React-based, test bun compatibility first)
   - terminal-kit (more reliable with bun)
   - blessed (classic, stable)

4. **Memory embedding provider?**
   - OpenAI (easy, costs API fees)
   - Local (free, requires GGUF model, slower)
   - Start with OpenAI, add local later?

5. **Timeline commitment?**
   - Are you ready for 6-8 weeks? (full autonomy)
   - Or prefer 3-4 weeks? (memory only, no autonomy)

---

## FILES IN THIS DIRECTORY

```
/home/ray/miniAgent/
├── README.md                           # Project overview (outdated, ignore)
├── ARCHITECTURE_ANALYSIS.md            # Original (incomplete, ignore)
├── MINIMAL_DESIGN.md                   # Original (incomplete, ignore)
├── QUICK_START.md                      # Original (outdated, ignore)
├── CHECKLIST.md                        # Original (needs revision)
├── PROJECT_STRUCTURE.md                # Still relevant
│
├── ARCHITECTURE_ANALYSIS_REVISED.md    # ⭐ READ THIS (complete)
├── MINIMAL_DESIGN_REVISED.md           # ⭐ READ THIS (your options)
└── PLANNING_SUMMARY.md                 # ⭐ THIS FILE (decision guide)
```

**Next**: I'll create updated QUICK_START and CHECKLIST docs after you choose your option.

---

## FINAL THOUGHTS

**What I got wrong initially**:

- Thought gateway was just RPC routing → Actually autonomy orchestrator
- Missed cron/heartbeat/hooks entirely → Core autonomous features
- Ignored memory system → Essential for recall
- Designed reactive chatbot → Should be autonomous agent

**What I learned**:

- OpenClaw is NOT "better ChatGPT"
- It's a **platform for autonomous agents**
- Autonomy requires infrastructure (cron, heartbeat, events)
- Memory requires indexing (vectors, hybrid search)
- The gateway/daemon is the heart of autonomy

**For your minimal version**:

- Can you skip autonomy? Yes, but then it's just a chatbot
- Can you skip memory? Yes, but then it forgets everything
- **Recommended**: Keep both (still fits 1GB VPS)
- Bun optimizations make this feasible

---

**Ready to decide?** Choose your option and let me know. I'll create updated implementation guides for your chosen path. 🚀
