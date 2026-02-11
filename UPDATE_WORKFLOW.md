# miniAgent Update System - Cherry-Pick Workflow

## Overview

miniAgent now has an automated cherry-pick workflow to stay updated with OpenClaw's bug fixes while maintaining the lightweight Discord-only configuration.

## What Was Done

### 1. Updated miniAgent to 2026.2.10

- **Version**: Updated from 2026.2.6-3 to 2026.2.10-miniAgent
- **Package name**: Changed from "openclaw" to "miniagent"
- **Description**: Updated to reflect Discord-only focus for 1GB RAM VPS

### 2. Cherry-Picked 5 Critical Bug Fixes

Successfully applied these upstream fixes:

1. **Discord agent component DM auth** (`4537ebc43`) - Security fix for Discord bot authorization
2. **/think off support** (`971c6dcbc`) - Honors `/think off` for reasoning models
3. **Web search cache key** (`a64daf6e7`) - Fixes cache invalidation for web search
4. **Bundled hooks fix** (`d9df72de8`) - Resolves tsdown migration issues
5. **maxTokens clamping** (`90f1ef2c0`) - Prevents invalid token configs

### 3. Created Automated Update Tools

#### `scripts/cherry-pick-criteria.md`

Documents what to include/exclude when updating:

- **AUTO-INCLUDE**: Bug fixes, security patches, Discord updates, core infrastructure
- **AUTO-EXCLUDE**: New channels (IRC, Matrix, Telegram, etc.), browser/canvas, mobile, docs
- **REVIEW**: New features, refactoring, testing improvements

#### `scripts/analyze-commits.sh`

Analyzes commits and categorizes them automatically:

```bash
cd /home/ray/miniAgent
bash scripts/analyze-commits.sh
```

Shows three categories:

- **AUTO-INCLUDE**: Critical fixes ready to cherry-pick
- **AUTO-EXCLUDE**: Changes not relevant to miniAgent
- **REVIEW NEEDED**: Changes requiring manual decision

#### `scripts/auto-cherry-pick-v2.sh`

Executes the cherry-pick process:

```bash
cd /home/ray/miniAgent
bash scripts/auto-cherry-pick-v2.sh
```

Features:

- Skips already-applied commits
- Handles conflicts gracefully
- Provides summary of applied/skipped commits

### 4. Created Browser Stub Files

Added missing stub files so miniAgent compiles cleanly:

- `src/browser/config.js`
- `src/browser/trash.js`
- `src/browser/routes/dispatcher.js`
- `src/browser/control-service.js`
- `src/canvas-host/a2ui.js`
- `src/canvas-host/server.js`

## How to Update miniAgent in the Future

### Option A: Automated Update (Recommended)

1. **Fetch latest from upstream**:

   ```bash
   cd /home/ray/miniAgent
   git fetch upstream main
   ```

2. **Analyze new commits**:

   ```bash
   bash scripts/analyze-commits.sh
   ```

   Review the output to see what's new.

3. **Update the commit list in auto-cherry-pick-v2.sh**:
   - Edit `scripts/auto-cherry-pick-v2.sh`
   - Replace the `COMMITS=()` array with commits from the AUTO-INCLUDE list
   - **Important**: List commits in reverse chronological order (oldest first)

4. **Run automated cherry-pick**:

   ```bash
   bash scripts/auto-cherry-pick-v2.sh
   ```

5. **Update version**:

   ```bash
   # Edit package.json, update version to match upstream + "-miniAgent"
   # Example: "version": "2026.2.11-miniAgent"
   ```

6. **Test**:

   ```bash
   bun src/index.ts gateway
   # Verify no version warnings
   # Test basic Discord functionality
   ```

7. **Commit**:
   ```bash
   git add -A
   git commit -m "chore: update miniAgent to 2026.X.Y with cherry-picked fixes"
   ```

### Option B: Manual Cherry-Pick

For specific commits you want:

```bash
git fetch upstream main
git log upstream/main --oneline | head -50  # See recent commits
git cherry-pick <commit-hash>               # Apply specific commit
```

## Update Frequency Recommendations

- **Weekly**: Run `git fetch upstream main` and `analyze-commits.sh` to stay aware
- **Monthly**: Cherry-pick accumulated bug fixes
- **As needed**: Apply critical security fixes immediately
- **Major versions**: Review carefully, may require more extensive changes

## Current Status

| Item                        | Status                                             |
| --------------------------- | -------------------------------------------------- |
| Base version                | OpenClaw 2026.2.10                                 |
| miniAgent version           | 2026.2.10-miniAgent                                |
| Commits ahead of fork point | 5 bug fixes applied                                |
| Upstream commits available  | ~254 remaining (mostly excluded channels/features) |
| Source compilation          | ✅ Working                                         |
| Version warning             | ✅ Fixed                                           |

## Notes

- **Conflicts are normal**: Many upstream commits touch removed channels and will conflict. The script handles this.
- **Not all commits apply**: Of 259 upstream commits, miniAgent needs only ~10-15% (bug fixes, core improvements)
- **Version strategy**: Always use `X.Y.Z-miniAgent` format to track upstream but stay distinct
- **Test after updates**: Always run `bun src/index.ts gateway` to verify no regressions

## What's Excluded (By Design)

miniAgent intentionally excludes these upstream changes:

- New messaging channels (IRC, Matrix, Feishu, etc.)
- Browser/Canvas functionality
- Mobile apps (macOS, iOS)
- UI/Control-UI changes (unless critical)
- Documentation updates (except security)
- Heavy dependencies

This keeps miniAgent lean and focused on Discord-only operation within 1GB RAM.
