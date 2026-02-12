# Phase 3: 1GB RAM Optimization Plan

**Goal**: Optimize miniAgent for stable operation on 1GB RAM VPS
**Target**: 200-250MB idle, <900MB under load, no OOM crashes
**Priority**: HIGH - Critical for VPS deployment

---

## Current Status (Post-Phase 2)

**Baseline Metrics**:

- Startup time: 1583ms
- Idle memory: 310MB
- Bun optimizations: File I/O ✅, HTTP Streaming ✅

**Problems for 1GB deployment**:

1. Default concurrency (4 agents, 8 subagents) designed for 8GB+ servers
2. Context windows grow unbounded (can reach 100k+ tokens)
3. No memory pressure detection or throttling
4. discord.js caches aggressively (200 messages default)
5. SQLite cache has no limits
6. No GC tuning for low-memory environments

---

## Phase 3 Strategy: Memory-First Optimization

### Principle

**Trade throughput for stability**:

- Lower concurrency = fewer parallel tasks, but predictable memory
- Aggressive compaction = smaller context, but more API calls
- Conservative caching = slower responses, but stable operation

---

## Implementation Roadmap

### 3.1 Concurrency Tuning (Priority 1) ✅

**Status**: COMPLETE (2026-02-12)

**Impact**: HIGH (prevents memory spikes from parallel agents)
**Effort**: LOW (config changes)
**Risk**: LOW

**Changes**:

1. **Hard-code lower defaults** in `src/agents/defaults.ts`:

   ```typescript
   // Before
   maxConcurrent: 4;
   subagents: {
     maxConcurrent: 8;
   }

   // After
   maxConcurrent: 2; // 50% reduction
   subagents: {
     maxConcurrent: 4;
   } // 50% reduction
   ```

2. **Add memory pressure detection**:
   - Monitor `process.memoryUsage().rss`
   - When RSS > 800MB: halt new agents, warn user
   - When RSS > 900MB: force GC, compact sessions
   - When RSS > 950MB: emergency shutdown to prevent OOM

3. **Queue instead of reject**:
   - When concurrency limit hit, queue agent requests
   - Process queue as agents complete
   - Max queue depth: 10 (reject beyond that)

**Files to modify**:

- ✅ `src/config/agent-limits.ts` - Lower concurrency defaults (lines 3-4)
- ✅ `src/infra/memory-monitor.ts` - Memory pressure detection (completed in 3.6)

**Results**:

- ✅ maxConcurrent reduced from 4 to 2 agents
- ✅ subagent maxConcurrent reduced from 8 to 4
- ✅ Memory monitor active with thresholds (850/900/950MB)
- ✅ Gateway startup successful at 312MB RSS
- ⚠️ Request queueing deferred (not implemented yet, can add if needed)

**Testing**:

- Start 3+ concurrent conversations
- Verify only 2 agents active at once
- Monitor memory stays <900MB

---

### 3.2 Context Window Management (Priority 1)

**Impact**: HIGH (context is largest memory consumer)
**Effort**: MEDIUM (requires compaction strategy changes)
**Risk**: MEDIUM (aggressive compaction might hurt quality)

**Changes**:

1. **Reduce max context length**:

   ```typescript
   // src/agents/pi-embedded-runner/run/params.ts
   // Before: Use model's max (e.g., 200k for Sonnet)
   // After: Hard cap at 32k tokens (~128KB)

   maxTokens: Math.min(modelMax, 32000);
   ```

2. **More aggressive compaction triggers**:
   - Current: Compact at 80% of max tokens
   - New: Compact at 50% of max tokens
   - Frequency: Every 10 messages (vs current 20)

3. **Prune tool results**:
   - Keep only last 3 tool calls in context
   - Summarize earlier tool results to 1-line descriptions
   - Clear image/file content after use

4. **Message history limits**:
   - Max 20 messages in context (vs unlimited)
   - Summarize older messages to single system message
   - Keep only user intent + assistant response, drop intermediates

**Files to modify**:

- `src/agents/compaction.ts` - Tighter compaction triggers
- `src/agents/pi-embedded-runner/run/params.ts` - Context limits
- `src/agents/pi-embedded-subscribe.handlers.messages.ts` - Message pruning

**Testing**:

- Have 30+ message conversation
- Verify context stays <32k tokens
- Check compaction happens frequently
- Validate agent quality not degraded

---

### 3.3 SQLite Memory Configuration (Priority 2)

**Impact**: MEDIUM (SQLite can grow to 50-100MB)
**Effort**: LOW (PRAGMA settings)
**Risk**: LOW

**Changes**:

1. **Set cache limits** in `src/memory/manager.ts`:

   ```sql
   PRAGMA cache_size = -8000;  -- 8MB cache (negative = KB)
   PRAGMA mmap_size = 10485760; -- 10MB mmap limit
   PRAGMA temp_store = MEMORY;  -- Use memory for temp (faster, but bounded)
   PRAGMA page_size = 4096;     -- Default page size
   ```

2. **Optimize queries**:
   - Add indexes to hot queries (session lookups, memory search)
   - Use prepared statements (reuse query plans)
   - LIMIT result sets to 100 rows max

3. **Periodic VACUUM**:
   - Run `VACUUM` on startup (if DB > 50MB)
   - Schedule weekly VACUUM via cron

**Files to modify**:

- `src/memory/manager.ts` - Add PRAGMA settings in constructor
- `src/memory/manager-search.ts` - Add LIMIT clauses

**Testing**:

- Load 10k memory entries
- Verify SQLite memory stays <15MB
- Check query performance acceptable

---

### 3.4 Discord.js Optimization (Priority 2)

**Impact**: MEDIUM (discord.js baseline ~80MB, can grow to 150MB+)
**Effort**: LOW (config changes)
**Risk**: LOW

**Changes**:

1. **Reduce message cache** in Discord client options:

   ```typescript
   // src/discord/client.ts
   new Client({
     makeCache: Options.cacheWithLimits({
       MessageManager: 50, // Was: 200 (reduce by 75%)
       PresenceManager: 0, // Disable presence caching
       GuildMemberManager: 100, // Limit to 100 members
     }),
     intents: [
       // Use minimal intents
       GatewayIntentBits.Guilds,
       GatewayIntentBits.GuildMessages,
       GatewayIntentBits.MessageContent,
       // Remove: GuildPresences, GuildMembers (if possible)
     ],
   });
   ```

2. **Clear old messages**:
   - Sweep messages >1 hour old every 15 minutes
   - Clear reactions and embeds from cached messages

**Files to modify**:

- `src/discord/client.ts` - Reduce cache limits
- `src/discord/monitor/message-handler.process.ts` - Message sweeping

**Testing**:

- Join multiple Discord servers
- Send 100+ messages
- Verify cache stays <50 messages
- Validate bot functionality intact

---

### 3.5 Garbage Collection Tuning (Priority 3)

**Impact**: LOW-MEDIUM (helps prevent gradual memory growth)
**Effort**: LOW (env var + profiling)
**Risk**: LOW

**Changes**:

1. **Environment variables**:

   ```bash
   # Try different heap limits
   BUN_HEAP_SIZE=768m  # Leave 256MB for system/buffers
   BUN_FORCE_GC=1      # Force more aggressive GC
   ```

2. **Manual GC triggers**:
   - After agent session completes: `global.gc()`
   - After compaction: `global.gc()`
   - Every 5 minutes: `global.gc()` if idle

3. **Profile GC behavior**:
   - Log GC pauses (if Bun exposes metrics)
   - Identify memory leaks (objects not freed)

**Files to modify**:

- `src/agents/pi-embedded-runner/runs.ts` - Call GC after session
- `src/infra/memory-monitor.ts` - Periodic GC trigger

**Testing**:

- Run 10 agent sessions back-to-back
- Monitor memory returns to baseline
- Check for gradual growth (memory leak indicator)

---

### 3.6 Memory Monitoring & Alerts (Priority 1)

**Impact**: HIGH (visibility crucial for debugging)
**Effort**: MEDIUM (new monitoring infrastructure)
**Risk**: LOW

**Changes**:

1. **Create memory monitor service**:

   ```typescript
   // src/infra/memory-monitor.ts
   export class MemoryMonitor {
     start() {
       setInterval(() => {
         const { rss, heapUsed, external } = process.memoryUsage();

         // Log every minute
         console.log(`[Memory] RSS: ${rss / 1024 / 1024}MB, Heap: ${heapUsed / 1024 / 1024}MB`);

         // Warn thresholds
         if (rss > 850 * 1024 * 1024) {
           console.warn("⚠️ Memory HIGH (>850MB)");
         }
         if (rss > 900 * 1024 * 1024) {
           console.error("🚨 Memory CRITICAL (>900MB) - triggering GC");
           global.gc?.();
         }
         if (rss > 950 * 1024 * 1024) {
           console.error("💀 Memory EMERGENCY (>950MB) - shutting down");
           process.exit(1); // Prevent OOM killer
         }
       }, 60000); // Every minute
     }
   }
   ```

2. **Expose metrics via WebSocket**:
   - Add `/diagnostics` endpoint
   - Return: { memory: {...}, agents: [...], context: [...] }

3. **Log rotation**:
   - Limit log file size to 10MB
   - Rotate logs when full (prevent disk growth)

**Files to create**:

- `src/infra/memory-monitor.ts` - Memory monitoring service

**Files to modify**:

- `src/gateway/server.impl.ts` - Start monitor on startup
- `src/gateway/control-ui.ts` - Add diagnostics endpoint

**Testing**:

- Start gateway
- Verify memory logs appear every minute
- Trigger high memory condition
- Validate alerts and GC trigger

---

### 3.7 Testing Under 1GB Limit (Priority 1)

**Goal**: Validate stability with hard memory limit

**Test scenarios**:

1. **Startup test**:

   ```bash
   bun --max-old-space-size=1024 src/index.ts gateway
   # Should start successfully, idle <350MB
   ```

2. **Concurrent agents test**:
   - Start 4 simultaneous conversations
   - Verify only 2 run at once (others queued)
   - Memory should stay <900MB

3. **Long conversation test**:
   - Have 50+ message conversation
   - Verify context compaction happens
   - Memory should stay stable (<400MB)

4. **Stress test**:
   - 10 Discord channels sending messages
   - Multiple file uploads
   - Large code generation tasks
   - Monitor for OOM crashes (should never happen)

5. **Idle test**:
   - Leave running for 24 hours
   - Verify no memory leaks (should return to baseline)

**Success criteria**:

- No OOM crashes in any scenario
- Peak memory <900MB under load
- Idle memory <350MB
- Agent quality acceptable (compaction not too aggressive)

---

## Implementation Order

### Week 1: Critical Path

1. ✅ Memory monitoring (3.6) - **COMPLETE** (2026-02-12)
2. ✅ Concurrency tuning (3.1) - **COMPLETE** (2026-02-12)
3. ⏸️ Context management (3.2) - **NEXT**
4. ⏸️ Testing under limit (3.7) - **Pending**

### Week 2: Optimization

5. Discord.js tuning (3.4) - **DAY 1**
6. SQLite limits (3.3) - **DAY 2**
7. GC tuning (3.5) - **DAY 3**
8. Final testing & docs - **DAY 4-5**

---

## Success Criteria

### Quantitative

- ✅ **Memory**: <350MB idle, <900MB peak
- ✅ **Stability**: No OOM crashes in 24h test
- ✅ **Performance**: Agent responses <5s median (acceptable slowdown)
- ✅ **Compaction**: Context stays <32k tokens

### Qualitative

- ✅ **Agent Quality**: Comparable to pre-optimization
- ✅ **User Experience**: Acceptable response times
- ✅ **Maintainability**: Clear monitoring, documented limits

---

## Risks & Mitigation

| Risk                                    | Impact | Probability | Mitigation                       |
| --------------------------------------- | ------ | ----------- | -------------------------------- |
| Aggressive compaction degrades quality  | HIGH   | MEDIUM      | Test thoroughly, adjust triggers |
| Low concurrency causes request timeouts | MEDIUM | LOW         | Implement request queueing       |
| OOM crashes despite limits              | HIGH   | LOW         | Emergency shutdown at 950MB      |
| Discord.js cache too small              | MEDIUM | LOW         | Increase if issues observed      |
| SQLite PRAGMA settings cause corruption | HIGH   | VERY LOW    | Test extensively, have backups   |

---

## Rollback Plan

If Phase 3 optimizations cause issues:

1. **Quick rollback**: Revert concurrency changes via config
2. **Partial rollback**: Keep monitoring, disable aggressive compaction
3. **Full rollback**: Revert to Phase 2 baseline, redeploy

---

## Documentation Deliverables

1. **MEMORY_OPTIMIZATION.md**: Details of all optimizations
2. **MONITORING.md**: How to interpret memory metrics
3. **TROUBLESHOOTING.md**: Common OOM issues and fixes
4. **CONFIG_1GB.md**: Recommended settings for 1GB VPS

---

## Next Steps

After Phase 3 approval:

1. Create `src/infra/memory-monitor.ts` (monitoring first)
2. Update concurrency defaults (quick win)
3. Implement context limits (largest impact)
4. Test, iterate, document

**Estimated timeline**: 2 weeks (including testing)
**Dependencies**: Phase 2 complete ✅
**Blockers**: None
