# START HERE: miniAgent Implementation Guide

**Welcome!** This document is your entry point for the miniAgent fork project.

Created: 2026-02-11
Status: Ready to execute
Approach: Modified fork of OpenClaw (remove channels, optimize for Bun)

---

## QUICK OVERVIEW

**What we're building**: Autonomous agent platform (based on OpenClaw) optimized for 1GB RAM VPS

**What we're keeping**:

- ✅ Full autonomy (cron, heartbeat, webhooks)
- ✅ Memory system (vector search)
- ✅ All agent capabilities
- ✅ TUI + Web Panel

**What we're removing**:

- ❌ Messaging channels (Discord, Telegram, Slack, WhatsApp, SMS)
- ❌ Complex auth profiles (simplified to .env)
- ❌ ~30% of codebase

**Why fork instead of building from scratch?**:

- 12+ critical components already implemented (lanes, broadcast, prompt building, etc.)
- 3-4 weeks vs 6-8 weeks
- Battle-tested code

---

## DOCUMENTATION STRUCTURE

**Read in this order**:

1. **✨ THIS FILE (START_HERE.md)** ← You are here
   - Overview and reading order

2. **📖 README.md**
   - Project overview
   - Quick comparison with OpenClaw
   - Goals and non-goals

3. **🗺️ FORK_PLAN.md** ⭐ MAIN IMPLEMENTATION GUIDE
   - Complete 4-phase plan
   - What to remove (detailed)
   - Bun migration workflow
   - Testing strategy
   - Timeline: 3-4 weeks

4. **❌ REMOVAL_PLAN.md**
   - Exact files/directories to remove
   - Removal script
   - Conservative approach
   - What to keep

5. **✅ CHECKLIST.md**
   - Detailed task list for all phases
   - Testing checklist
   - Deployment checklist
   - Success criteria

6. **📚 Reference Docs** (background reading):
   - ARCHITECTURE_ANALYSIS_REVISED.md - Complete OpenClaw breakdown
   - MINIMAL_DESIGN_REVISED.md - Architecture options (we chose Option A)
   - MISSING_COMPONENTS.md - Why fork is better
   - PLANNING_SUMMARY.md - Decision framework
   - PROJECT_STRUCTURE.md - File organization

---

## QUICK START (3 Steps)

### Step 1: Read Planning Docs (1-2 hours)

```bash
cd /home/ray/miniAgent

# Read this order:
cat START_HERE.md          # This file
cat README.md              # Overview
cat FORK_PLAN.md           # Main plan (MOST IMPORTANT)
cat REMOVAL_PLAN.md        # Removal details
cat CHECKLIST.md           # Task checklist
```

**Key things to understand**:

- Why we're forking vs building from scratch
- What autonomy features exist (cron, heartbeat, hooks)
- What memory system provides
- What we're removing and why
- How Bun migration works

### Step 2: Fork OpenClaw (30 minutes)

```bash
cd /home/ray

# Create fork
cp -r openclaw miniAgent
cd miniAgent

# Optional: Initialize git
git init
git add .
git commit -m "Initial fork from OpenClaw"
git checkout -b remove-channels
```

### Step 3: Execute FORK_PLAN Phases (3-4 weeks)

Follow **FORK_PLAN.md** and **CHECKLIST.md** step-by-step:

**Week 1: Phase 1 (Fork & Removal)**

- Remove channel code
- Test baseline with Node.js

**Week 2: Phase 2 (Bun Migration) + Phase 3 (Config)**

- Migrate to Bun APIs
- Simplify config to .env

**Week 3-4: Phase 4 (Testing & Optimization)**

- Comprehensive testing
- Performance optimization
- Documentation
- Deployment

---

## TIMELINE & EFFORT

| Phase                     | Duration      | Effort | Key Deliverable                   |
| ------------------------- | ------------- | ------ | --------------------------------- |
| 1. Fork & Removal         | 3-5 days      | Medium | Channels removed, baseline works  |
| 2. Bun Migration          | 5-7 days      | High   | Runs with Bun, APIs migrated      |
| 3. Config Simplification  | 2-3 days      | Low    | Simple .env config                |
| 4. Testing & Optimization | 5-7 days      | Medium | Deployed to VPS, fully functional |
| **Total**                 | **3-4 weeks** |        | **Production-ready miniAgent**    |

---

## SUCCESS METRICS

**Phase 1**:

- ✅ Codebase 30% smaller
- ✅ 30+ fewer dependencies
- ✅ Core works without channels

**Phase 2**:

- ✅ Runs with Bun
- ✅ Startup < 1s
- ✅ Memory < 300MB

**Phase 3**:

- ✅ Simple .env setup works

**Phase 4**:

- ✅ All autonomy features functional
- ✅ Memory system works
- ✅ Deployed to 1GB VPS
- ✅ Runs 24 hours without issues

---

## WHEN TO REFER TO WHICH DOC

**Starting out**:

- START_HERE.md (this file)
- README.md
- FORK_PLAN.md

**During removal (Phase 1)**:

- REMOVAL_PLAN.md
- CHECKLIST.md Phase 1

**During Bun migration (Phase 2)**:

- FORK_PLAN.md Phase 2
- CHECKLIST.md Phase 2
- Test each migration step

**During config simplification (Phase 3)**:

- FORK_PLAN.md Phase 3
- CHECKLIST.md Phase 3

**During testing (Phase 4)**:

- FORK_PLAN.md Phase 4
- CHECKLIST.md Phase 4
- Create new docs (API.md, DEPLOY.md, etc.)

**Background reference**:

- ARCHITECTURE_ANALYSIS_REVISED.md - Understand OpenClaw internals
- MINIMAL_DESIGN_REVISED.md - Architecture options
- MISSING_COMPONENTS.md - What we would've built from scratch

---

## DIRECTORY STRUCTURE

```
/home/ray/miniAgent/
├── START_HERE.md                      # ← You are here
├── README.md                          # Project overview
├── FORK_PLAN.md                       # ⭐ Main implementation guide
├── REMOVAL_PLAN.md                    # Removal details
├── CHECKLIST.md                       # Task checklist
│
├── ARCHITECTURE_ANALYSIS_REVISED.md   # OpenClaw deep-dive
├── MINIMAL_DESIGN_REVISED.md          # Architecture options
├── MISSING_COMPONENTS.md              # Gap analysis
├── PLANNING_SUMMARY.md                # Decision framework
├── PROJECT_STRUCTURE.md               # File organization
│
└── (After fork, you'll have):
    ├── src/                           # OpenClaw source (to be modified)
    ├── web/                           # Web panel
    ├── scripts/                       # Removal and migration scripts
    ├── .env                           # Your config
    ├── package.json                   # Dependencies
    └── ...
```

---

## QUESTIONS & ANSWERS

**Q: Do I need to understand all of OpenClaw's architecture?**
A: No. Read ARCHITECTURE_ANALYSIS_REVISED.md sections 1, 2, 3 (overview, Pi-agent, autonomy). The fork approach means you don't need to understand implementation details.

**Q: What if Bun doesn't support a dependency?**
A: See FORK_PLAN.md Phase 2.1 for compatibility audit process. Most JS/TS works. Native modules may need alternatives.

**Q: Can I add back Discord later?**
A: Yes, but carefully. You'd need to restore channel code and dependencies. Better to keep it if you might want it.

**Q: What if I break something during removal?**
A: Git reset or restore from backup. See REMOVAL_PLAN.md recovery section.

**Q: How do I know it's working?**
A: Follow CHECKLIST.md testing sections. Each phase has verification steps.

**Q: What if memory usage is too high?**
A: See FORK_PLAN.md Phase 4.3 optimization strategies.

---

## TROUBLESHOOTING

**"Cannot find module X"**:

- Check if X is a channel dependency
- Remove import or install dependency
- See REMOVAL_PLAN.md

**"Bun doesn't support Y"**:

- Check Bun docs for alternative
- Find pure-JS replacement
- Keep Node.js for that module (hybrid approach)

**"Tests failing after removal"**:

- Check if tests are for channels
- Remove channel tests
- Fix broken imports

**"Memory higher than expected"**:

- Profile with Bun inspector
- Check embedding cache size
- Review session history limits

---

## GETTING HELP

**Resources**:

- Bun docs: https://bun.sh/docs
- OpenClaw source: /home/ray/openclaw
- All planning docs in this directory

**If stuck**:

1. Check FORK_PLAN.md for that phase
2. Check CHECKLIST.md for that task
3. Check TROUBLESHOOTING section
4. Review OpenClaw source

---

## WHAT'S NEXT?

**Right now**:

1. ✅ Read this file (done!)
2. → Read README.md
3. → Read FORK_PLAN.md (main guide)
4. → Start Phase 1 (fork & removal)

**After Phase 1**:

- Follow CHECKLIST.md step-by-step
- Refer to FORK_PLAN.md for details
- Test after each phase

**After completion**:

- Deploy to VPS
- Monitor for 24 hours
- Document any issues
- Enjoy your autonomous agent!

---

## FINAL NOTES

**This is a significant project**:

- 3-4 weeks of focused work
- Requires patience and testing
- Worth it for autonomous agent on 1GB VPS

**You have complete documentation**:

- Every step planned
- Every decision documented
- Every risk identified

**You can do this**:

- Fork approach reduces complexity
- Most code works as-is with Bun
- Testing at each phase catches issues early

---

**Ready?** → Read **README.md** next, then **FORK_PLAN.md**

Good luck! 🚀
