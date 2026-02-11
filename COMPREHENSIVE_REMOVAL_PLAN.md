# Comprehensive Removal Plan - REVISED

## Based on User Requirements: Keep Gmail, Copilot, Auth Extensions, Docs, TTS, Voice-call, All Skills

**User Confirmed**:

- OpenClaw already runs fine with Bun on 1GB VPS
- Removal is for cleanup, not critical memory
- Keep: Gmail, GitHub Copilot, auth extensions, docs, Discord, TTS, Voice-call
- Skills: Keep all skills (they sound useful)
- Remove: Browser (heavy), Canvas (heavy ~62MB), Test files (not needed)

---

## PRIORITY 1: DEFINITELY REMOVE (~762MB)

### 1.1 Local LLM Integration - **REMOVE (~500MB)**

**Files to Remove**:

```bash
rm src/memory/node-llama.ts
rm src/types/node-llama-cpp.d.ts
rm src/agents/models-config.providers.ollama.test.ts
```

**Dependencies to Remove**:

```bash
bun remove node-llama-cpp  # ~500MB
bun remove ollama          # ~50MB
```

**Config Changes**:

- Remove `ollama` from provider configs
- Ensure memory system uses OpenAI for embeddings

---

### 1.2 Browser Automation - **REMOVE (~100MB)**

**Directory to Remove**:

```bash
rm -rf src/browser/  # 704KB
```

**Dependencies to Remove**:

```bash
bun remove playwright-core  # ~100MB
```

---

### 1.3 Mobile/Desktop Apps - **REMOVE (~192MB)**

**Directories to Remove**:

```bash
rm -rf apps/android/  # 184MB
rm -rf apps/ios/      # 2.4MB
rm -rf apps/macos/    # 5.8MB
rm -rf apps/shared/   # 644KB
rm -rf src/macos/     # 24KB
```

---

### 1.4 Canvas Host & Dependencies - **REMOVE (~62MB)**

**Directories to Remove**:

```bash
rm -rf src/canvas-host/  # 592KB
rm -rf skills/canvas/    # 12KB
```

**Dependencies to Remove**:

```bash
bun remove @napi-rs/canvas  # ~62MB native binaries
```

**Reason**: Heavy native canvas rendering library. Not needed on VPS.

---

## PRIORITY 2: MESSAGING CHANNELS - KEEP DISCORD ONLY

### Keep: Discord Only

**Files to KEEP**:

```bash
# KEEP these
src/discord/
extensions/discord/
```

### Remove: All Other Channels

**Directories to Remove**:

```bash
# Messaging platforms
rm -rf src/telegram/      # 804KB
rm -rf src/slack/         # 460KB
rm -rf src/whatsapp/      # 12KB
rm -rf src/signal/        # 164KB
rm -rf src/imessage/      # 128KB
rm -rf src/line/          # 304KB

# Channel extensions
rm -rf extensions/telegram/
rm -rf extensions/slack/
rm -rf extensions/whatsapp/
rm -rf extensions/signal/
rm -rf extensions/imessage/
rm -rf extensions/bluebubbles/  # 436KB (iMessage)
rm -rf extensions/line/
rm -rf extensions/feishu/       # 324KB
rm -rf extensions/googlechat/   # 160KB
rm -rf extensions/matrix/       # 440KB
rm -rf extensions/mattermost/   # 156KB
rm -rf extensions/msteams/      # 476KB
rm -rf extensions/nextcloud-talk/ # 140KB
rm -rf extensions/nostr/        # 276KB
rm -rf extensions/twitch/       # 300KB
rm -rf extensions/zalo/         # 152KB
rm -rf extensions/zalo-user/    # 172KB
rm -rf extensions/tlon/         # 168KB
rm -rf extensions/open-prose/   # 968KB
```

**Dependencies to Remove**:

```bash
# Telegram
bun remove grammy @grammyjs/runner @grammyjs/transformer-throttler

# Slack
bun remove @slack/bolt @slack/web-api

# WhatsApp
bun remove @whiskeysockets/baileys

# LINE
bun remove @line/bot-sdk

# Signal
bun remove signal-utils
```

---

## PRIORITY 3: KEEP TTS & VOICE-CALL

### ✅ Text-to-Speech (TTS) - KEEP

**Files to KEEP**:

```bash
# KEEP TTS (lightweight: ~816KB)
src/tts/  # 72KB source
extensions/talk-voice/
# Dependency: node-edge-tts (~816KB)
```

**Reason**: Lightweight (~816KB total), useful for voice output and accessibility.

### ✅ Voice Call - KEEP

**Extension to KEEP**:

```bash
# KEEP voice-call (lightweight: ~436KB)
extensions/voice-call/
```

**Reason**: Lightweight extension (~436KB), potentially useful for voice features.

---

## PRIORITY 4: SKILLS - KEEP ALL

**Keep All Skills**:

```bash
# KEEP all skills/ directory (53 skills total)
# User confirmed: "a lot of them sound useful"
skills/  # Keep entire directory
```

**Reason**: While user hasn't used many yet, they find them potentially useful for future tasks. Memory footprint of skills is minimal (~1-2MB total) so keeping all has negligible impact on 1GB VPS.

**Notable Skills Included**:

- **Productivity**: 1password, notion, obsidian, trello, bear-notes, apple-notes/reminders
- **Development**: github, coding-agent, tmux, session-logs, skill-creator
- **Communication**: discord, slack, bluebubbles, voice-call
- **AI/ML**: gemini, openai-image-gen, openai-whisper, sherpa-onnx-tts
- **Smart Home**: openhue, sonoscli
- **Media**: spotify-player, songsee, video-frames, camsnap
- **Utilities**: weather, healthcheck, local-places, goplaces, food-order
- **Platform-specific**: things-mac, peekaboo (macOS), nano-banana-pro

---

## WHAT TO KEEP (Per User Request)

### ✅ Gmail Integration - KEEP

**Files to KEEP**:

```bash
# KEEP all Gmail files
src/hooks/gmail.ts
src/hooks/gmail-ops.ts
src/hooks/gmail-setup-utils.ts
src/hooks/gmail-watcher.ts
```

---

### ✅ GitHub Copilot & Auth Extensions - KEEP

**Files to KEEP**:

```bash
# KEEP Copilot
src/providers/github-copilot-auth.ts
src/providers/github-copilot-models.ts
src/providers/github-copilot-token.ts

# KEEP auth extensions
extensions/copilot-proxy/
extensions/google-antigravity-auth/
extensions/google-gemini-cli-auth/
extensions/minimax-portal-auth/
extensions/qwen-portal-auth/
```

---

### ✅ Documentation - KEEP

**Keep**:

```bash
# KEEP docs/
docs/  # 14MB, 681 files
```

---

### ✅ TTS & Voice-call - KEEP

**Files to KEEP**:

```bash
# KEEP TTS
src/tts/  # 72KB source
extensions/talk-voice/
# Dependency: node-edge-tts (~816KB)

# KEEP Voice-call
extensions/voice-call/  # 436KB
```

**Reason**: Both lightweight (~1.3MB total), useful for voice features and accessibility.

---

### ✅ Core Components - KEEP

**Agent Core**:

```
src/agents/pi-embedded-runner/
src/agents/pi-embedded.ts
src/agents/pi-embedded-subscribe*
src/agents/pi-tools.ts
```

**Autonomy**:

```
src/cron/
src/heartbeat/
src/hooks/bundled/
src/hooks/gmail*  # Keep Gmail hooks
src/system-events/
```

**Memory** (cloud-based):

```
src/memory/
# Using OpenAI for embeddings
```

**Session Management**:

```
src/sessions/
```

**Discord Channel**:

```
src/discord/
extensions/discord/
```

**UI**:

```
src/tui/
src/web/
ui/
```

**Gateway**:

```
src/gateway/
```

**Config & Infrastructure**:

```
src/config/
src/auth/
src/logger/
src/providers/  # Keep all (including Copilot)
```

---

## UPDATED REMOVAL SCRIPT

**Create revised removal script**:

```bash
cat > scripts/comprehensive-removal-revised.sh << 'EOF'
#!/usr/bin/env bash
set -e

echo "🗑️  Comprehensive removal for miniAgent (User-customized)"
echo ""
echo "Removing:"
echo "  - Local LLM (~500MB)"
echo "  - Browser automation (~100MB)"
echo "  - Canvas rendering (~62MB)"
echo "  - Mobile/desktop apps (~192MB)"
echo "  - Non-Discord channels"
echo ""
echo "Keeping:"
echo "  ✅ Discord channel"
echo "  ✅ Gmail integration"
echo "  ✅ GitHub Copilot + auth extensions"
echo "  ✅ Documentation"
echo "  ✅ TTS & Voice-call"
echo "  ✅ All skills"
echo ""

# Priority 1: Local LLM (~500MB)
echo "Removing local LLM support..."
rm -f src/memory/node-llama.ts
rm -f src/types/node-llama-cpp.d.ts
rm -f src/agents/models-config.providers.ollama.test.ts
bun remove node-llama-cpp ollama || true

# Priority 1: Browser automation (~100MB)
echo "Removing browser automation..."
rm -rf src/browser/
bun remove playwright-core || true

# Priority 1: Canvas rendering (~62MB)
echo "Removing canvas host and dependencies..."
rm -rf src/canvas-host/
rm -rf skills/canvas/
bun remove @napi-rs/canvas || true

# Priority 1: Mobile/desktop apps (~192MB)
echo "Removing mobile/desktop apps..."
rm -rf apps/android/
rm -rf apps/ios/
rm -rf apps/macos/
rm -rf apps/shared/
rm -rf src/macos/

# Priority 2: Non-Discord channels
echo "Removing non-Discord messaging channels..."
rm -rf src/telegram/
rm -rf src/slack/
rm -rf src/whatsapp/
rm -rf src/signal/
rm -rf src/imessage/
rm -rf src/line/

rm -rf extensions/telegram/
rm -rf extensions/slack/
rm -rf extensions/whatsapp/
rm -rf extensions/signal/
rm -rf extensions/imessage/
rm -rf extensions/bluebubbles/
rm -rf extensions/line/
rm -rf extensions/feishu/
rm -rf extensions/googlechat/
rm -rf extensions/matrix/
rm -rf extensions/mattermost/
rm -rf extensions/msteams/
rm -rf extensions/nextcloud-talk/
rm -rf extensions/nostr/
rm -rf extensions/twitch/
rm -rf extensions/zalo/
rm -rf extensions/zalo-user/
rm -rf extensions/tlon/
rm -rf extensions/open-prose/

bun remove grammy @grammyjs/runner @grammyjs/transformer-throttler || true
bun remove @slack/bolt @slack/web-api || true
bun remove @whiskeysockets/baileys || true
bun remove @line/bot-sdk || true
bun remove signal-utils || true

# Priority 3: TTS & Voice-call - KEEP (user requested)
echo "Keeping TTS and voice-call..."

# Priority 4: Skills - KEEP ALL (user confirmed they sound useful)
echo "Keeping all skills..."

# Priority 5: Test files
echo "Removing test files..."
find . -name "*.test.ts" -type f -delete || true
find . -name "*.spec.ts" -type f -delete || true
rm -rf src/test-helpers/ || true
rm -rf src/test-utils/ || true
rm -rf src/agents/test-helpers/ || true
bun remove vitest @vitest/coverage-v8 || true

# Priority 5: Unused extensions (keep what user needs)
echo "Removing unused extensions..."
rm -rf extensions/diagnostics-otel/ || true
rm -rf extensions/memory-lancedb/ || true

# NOT removing (per user request):
# - extensions/voice-call/ (user wants to keep)
# - extensions/talk-voice/ (TTS)
# - extensions/copilot-proxy/
# - extensions/google-antigravity-auth/
# - extensions/google-gemini-cli-auth/
# - extensions/minimax-portal-auth/
# - extensions/qwen-portal-auth/
# - docs/
# - src/hooks/gmail*

echo ""
echo "✅ Removal complete!"
echo ""
echo "Kept per user request:"
echo "  ✅ Discord channel (src/discord/, extensions/discord/)"
echo "  ✅ Gmail integration (src/hooks/gmail*)"
echo "  ✅ GitHub Copilot provider + auth extensions"
echo "  ✅ Documentation (docs/)"
echo "  ✅ TTS & Voice-call (lightweight)"
echo "  ✅ All skills (skills/)"
echo ""
echo "Removed:"
echo "  ❌ Local LLM (~500MB)"
echo "  ❌ Browser automation (~100MB)"
echo "  ❌ Canvas rendering (~62MB)"
echo "  ❌ Mobile apps (~192MB)"
echo "  ❌ Non-Discord channels"
echo ""
echo "Next steps:"
echo "1. Run: bun install"
echo "2. Test: bun src/index.ts daemon --help"
echo "3. Verify Discord: ls src/discord/"
echo "4. Verify Gmail hooks: ls src/hooks/gmail*"
echo "5. Verify Copilot: ls src/providers/github-copilot*"
echo "6. Verify skills: ls skills/"
EOF

chmod +x scripts/comprehensive-removal-revised.sh
```

---

## VERIFICATION CHECKLIST

After running removal script:

**Verify Kept**:

- [ ] Discord channel exists (`ls src/discord/ extensions/discord/`)
- [ ] Gmail integration exists (`ls src/hooks/gmail*`)
- [ ] GitHub Copilot exists (`ls src/providers/github-copilot*`)
- [ ] Auth extensions exist (`ls extensions/*-auth/`)
- [ ] Documentation exists (`ls docs/`)
- [ ] TTS exists (`ls src/tts/`)
- [ ] Voice-call exists (`ls extensions/voice-call/`)
- [ ] All skills exist (`ls skills/` → should see all original skills)

**Verify Removed**:

- [ ] No local LLM (`grep -r "node-llama\|ollama" src/` → nothing)
- [ ] No browser (`ls src/browser/` → not found)
- [ ] No canvas (`ls src/canvas-host/` → not found)
- [ ] No mobile apps (`ls apps/` → not found)
- [ ] No other channels (`ls src/telegram/` → not found)

**Verify Functionality**:

- [ ] `bun install` succeeds
- [ ] `tsc --noEmit` compiles
- [ ] `bun src/index.ts daemon --help` works
- [ ] Discord channel imports work
- [ ] Gmail hooks import correctly
- [ ] Copilot provider available

---

## ESTIMATED FINAL SIZE

**Removed**:

- Local LLM: ~500MB
- Browser: ~100MB
- Canvas rendering: ~62MB
- Mobile apps: ~192MB
- Channels: ~100MB (deps)
- **Total removed: ~954MB**

**Kept** (compared to aggressive removal):

- Gmail integration: ~20KB
- Copilot + auth extensions: ~300KB
- Documentation: ~14MB
- TTS & Voice-call: ~1.3MB
- All skills: ~1-2MB
- **Additional kept: ~17MB**

**Net savings**: ~937MB

**Memory Usage**: Should still run fine on 1GB VPS since you confirmed OpenClaw already works

---

## CONFIGURATION

### Memory System Config

**Ensure cloud embeddings**:

In `.env`:

```env
# Use OpenAI for embeddings (NOT local)
MEMORY_PROVIDER=openai
MEMORY_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-...

# For Copilot support
GITHUB_COPILOT_TOKEN=ghu_...
```

---

## NEXT STEPS

1. **Review this revised plan**
2. **Create fork**:

   ```bash
   cd /home/ray
   cp -r openclaw miniAgent
   cd miniAgent
   ```

3. **Run revised removal script**:

   ```bash
   mkdir -p scripts
   # Copy script from above
   ./scripts/comprehensive-removal-revised.sh
   ```

4. **Verify everything**:

   ```bash
   bun install
   bun src/index.ts daemon --help
   ls src/discord/
   ls src/hooks/gmail*
   ls src/providers/github-copilot*
   ls skills/  # Should see all original skills
   ```

5. **Proceed to Bun migration** (FORK_PLAN.md Phase 2)

---

See **FORK_PLAN.md** for overall implementation plan.
See **CHECKLIST.md** for detailed task tracking.
