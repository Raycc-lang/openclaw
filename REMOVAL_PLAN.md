# Channel Removal Plan

## Exact Files and Directories to Remove from OpenClaw Fork

Based on OpenClaw structure at `/home/ray/openclaw`

---

## DIRECTORIES TO REMOVE

### Messaging Platform Channels

**Check before removing**: Some directories might not exist in your version.

```bash
cd /home/ray/miniAgent  # After fork

# Remove platform-specific plugins (if they exist)
rm -rf src/channels/plugins/actions/discord/
rm -rf src/channels/plugins/actions/telegram/  # if exists
rm -rf src/channels/plugins/actions/slack/     # if exists

# Check what remains in plugins
ls src/channels/plugins/actions/
# Keep generic actions, remove platform-specific

# Note: src/channels/web/ should be KEPT (needed for web panel)
# Note: src/channels/plugins/ may have generic code - audit before removing entirely
```

**IMPORTANT**: OpenClaw's channel structure is different than expected.
We need to audit carefully:

- `src/channels/web/` → KEEP (web panel)
- `src/channels/plugins/` → AUDIT (may have generic + platform-specific)
- `src/channels/allowlists/` → CHECK (may be generic)

### Recommended Approach: Selective Removal

**Step 1: Audit channels**:

```bash
# List all files under channels
find src/channels -type f -name "*.ts" | grep -v test | head -50

# Search for platform names
grep -r "discord\|telegram\|slack\|whatsapp" src/channels --include="*.ts" | cut -d: -f1 | sort -u
```

**Step 2: Remove only platform-specific code**:

Based on grep results, identify and remove platform-specific files/directories.

---

## DEPENDENCIES TO REMOVE

**From package.json**:

```bash
# These are confirmed channel dependencies
bun remove @slack/bolt @slack/web-api discord-api-types

# Check for others
grep -E "discord|telegraf|telegram|twilio|whatsapp" package.json
# Remove any found
```

**Common channel dependencies to check**:

- `discord.js`
- `discord-api-types`
- `telegraf` (Telegram)
- `@slack/bolt`
- `@slack/web-api`
- `twilio` (SMS/WhatsApp)
- `node-telegram-bot-api`

---

## FILES TO MODIFY

### 1. Gateway Startup (src/gateway/server.impl.ts or similar)

**Search for channel initialization**:

```bash
grep -r "startChannel\|initChannel\|discord\|telegram\|slack" src/gateway
```

**Remove**:

- Channel service initialization
- Platform-specific startup logic
- Keep: web server, cron, heartbeat, hooks

### 2. CLI Commands (src/commands/ or src/index.ts)

**Search for**:

```bash
grep -r "discord\|telegram\|slack" src/commands
```

**Remove**:

- Channel management commands
- Platform login/logout commands

**Keep**:

- daemon
- tui
- agent
- cron
- memory
- heartbeat
- session

### 3. Config Types (src/config/ or wherever config types live)

**Remove**:

- Discord token config
- Telegram token config
- Slack token config
- Channel-specific settings

**Keep**:

- LLM API keys
- Gateway settings
- Heartbeat settings
- Memory settings

---

## CONSERVATIVE REMOVAL SCRIPT

**Create removal script** (run after fork):

```bash
cat > scripts/remove-channels.sh << 'EOF'
#!/usr/bin/env bash
set -e

echo "🗑️  Removing messaging platform code from miniAgent fork..."

# 1. Remove confirmed platform-specific plugins
echo "Removing Discord plugin..."
rm -rf src/channels/plugins/actions/discord/ || echo "  (not found)"

# 2. Remove dependencies
echo "Removing channel dependencies..."
bun remove @slack/bolt @slack/web-api discord-api-types || echo "  (already removed)"

# 3. Search for remaining platform references
echo ""
echo "🔍 Searching for remaining platform references..."
echo "   (Review these manually before removing)"
echo ""

grep -r "discord" src/ --include="*.ts" | grep -v "node_modules" | cut -d: -f1 | sort -u || echo "  No discord references found"
grep -r "telegram" src/ --include="*.ts" | grep -v "node_modules" | cut -d: -f1 | sort -u || echo "  No telegram references found"
grep -r "@slack" src/ --include="*.ts" | grep -v "node_modules" | cut -d: -f1 | sort -u || echo "  No slack references found"

echo ""
echo "✅ Channel removal complete"
echo "⚠️  Review the search results above and manually remove any remaining platform-specific code"
EOF

chmod +x scripts/remove-channels.sh
```

---

## MANUAL REVIEW CHECKLIST

After running removal script:

- [ ] Search for `import.*discord` → remove or Replace with stubs
- [ ] Search for `import.*telegraf` → remove or stub
- [ ] Search for `import.*slack` → remove or stub
- [ ] Check `src/auto-reply/` for channel routing → remove routing, keep prompt building
- [ ] Check `src/gateway/` for channel services → remove platform services
- [ ] Check types (e.g., `ChannelType` enum) → remove platform values
- [ ] Run `bun install` → check for unused dependency warnings
- [ ] Try `bun src/index.ts --help` → verify no channel commands

---

## TESTING AFTER REMOVAL

```bash
# Install (should work)
bun install

# TypeScript check (should compile)
bun run typecheck  # or tsc --noEmit

# Try starting daemon (should not crash on missing modules)
bun src/index.ts daemon --help

# If start fails with "Cannot find module X":
# - Check if X is a channel dependency
# - Remove import or stub it out
```

---

## RECOVERY PLAN

If you remove too much and break something:

```bash
# Reset from git
git reset --hard HEAD

# Or restore from backup
cd /home/ray
rm -rf miniAgent
cp -r openclaw miniAgent
# Try again with more conservative removals
```

---

## WHAT TO KEEP (Don't Remove)

**Critical to keep**:

- ✅ `src/channels/web/` (if it's for web panel)
- ✅ `src/channels/allowlists/` (if used for access control)
- ✅ `src/channels/plugins/` generic plugins (audit first)
- ✅ All `src/gateway/` except platform services
- ✅ All `src/auto-reply/` except channel routing
- ✅ All `src/agents/`
- ✅ All `src/cron/`
- ✅ All `src/infra/heartbeat*`
- ✅ All `src/memory/`
- ✅ `src/commands/daemon.ts`, `tui.ts`, `agent.ts`, etc.
- ✅ `web/` directory (Next.js web panel)

---

## NEXT STEPS

1. **Run audit first**: `find src/channels -type f`
2. **Manually review** what can be safely removed
3. **Create backup**: `cp -r miniAgent miniAgent-backup`
4. **Run removal script**: `./scripts/remove-channels.sh`
5. **Manual cleanup**: Address items in search results
6. **Test**: `bun install && bun src/index.ts daemon --help`
7. **Commit**: `git commit -m "Remove messaging platform code"`

See **FORK_PLAN.md** Phase 1.2 for full context.
