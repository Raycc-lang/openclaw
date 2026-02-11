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
