#!/bin/bash
# Auto-cherry-pick critical commits for miniAgent with better conflict handling

# Don't exit on errors - we handle them
set +e

BASE_COMMIT="875324e7c"
UPSTREAM="upstream/main"

# Array of commits to cherry-pick (in reverse order - oldest first)
COMMITS=(
    "2b6cf03b4" # fix(build): support daemon-cli .mjs bundles in compat shim
    "80d42eb0b" # fix(docker): support .mjs entrypoints in images and e2e
    "1007d71f0" # fix: comprehensive BlueBubbles and channel cleanup
    "b8f740fb1" # fix(gateway): use LAN IP for WebSocket/probe URLs when bind=lan
    "0deb8b0da" # fix: recover from context overflow caused by oversized tool results
    "8fae55e8e" # fix(cron): share isolated announce flow + harden cron scheduling/delivery
    "191da1feb" # fix: context overflow compaction and subagent announce improvements
    "bc475f017" # fix(ui): smooth chat refresh scroll and suppress new-messages badge flash
    "9949f8259" # fix(discord): support forum channel thread-create
    "db137dd65" # fix(paths): respect OPENCLAW_HOME for all internal path resolution
    "eed580d31" # fix(config): clamp maxTokens to contextWindow to prevent invalid configurations
    "456bd5874" # fix(paths): structurally resolve home dir to prevent Windows path bugs
    "5ac1be9cb" # fix: all bundled hooks broken since 2026.2.2 (tsdown migration)
    "8d96955e1" # fix(routing): make bindings dynamic by calling loadConfig() per-message
    "6ed255319" # fix(skills): ignore Python venvs and caches in skills watcher
    "5f2ad938a" # fix(tools): include provider-specific settings in web search cache key
    "71b4be879" # fix: handle 400 status in failover to enable model fallback
    "c984e6d8d" # fix: prevent false positive context overflow detection in conversation text
    "512b2053c" # fix(web_search): Fix invalid model name sent to Perplexity
    "394d60c1f" # fix(onboarding): auto-install shell completion in QuickStart
    "3e63b2a4f" # fix(cli): improve plugins list source display
    "ec55583bb" # fix: align extension tests and fetch typing for gate stability
    "1fad19008" # fix: improve code-size gate output and duplicate detection
    "97b3ee7ec" # Fix: Honor `/think off` for reasoning-capable models
    "ead3bb645" # discord: auto-create thread when sending to Forum/Media channels
    "d3c71875e" # fix: cap Discord gateway reconnect at 50 attempts to prevent infinite loop
    "c2b2d535f" # fix: suggest /clear in context overflow error message
    "0c7bc303c" # fix(tools): correct Grok response parsing for xAI Responses API
    "757522fb4" # fix(memory): default batch embeddings to off
    "e19a23520" # fix: unify session maintenance and cron run pruning
    "f17c978f5" # refactor(security,config): split oversized files
    "4537ebc43" # fix: enforce Discord agent component DM auth
    "8ff1618bf" # Discord: add exec approval cleanup option
    "53273b490" # fix(auto-reply): prevent sender spoofing in group prompts
    "ef4a0e92b" # fix(memory/qmd): scope query to managed collections
    "67d25c653" # fix: strip reasoning tags from messaging tool text to prevent <think> leakage
    "22458f57f" # fix(agents): strip [Historical context: ...] and tool call text from streaming path
    "88428260c" # fix(web_search): remove unsupported include param from Grok API calls
    "74273d62d" # fix(pairing): show actual code in approval command instead of placeholder
    "27453f5a3" # fix(web-search): handle xAI Responses API format in Grok provider
    "cfd112952" # fix(gateway): default-deny missing connect scopes
    "92702af7a" # fix(plugins): ignore install scripts during plugin/hook install
    "66ca5746c" # fix(config): avoid redacting maxTokens-like fields
    "f32214ea2" # fix(cli): drop logs --localTime alias noise
)

echo "=== Starting miniAgent cherry-pick update ==="
echo "Total commits to apply: ${#COMMITS[@]}"
echo ""

SUCCESS_COUNT=0
SKIP_COUNT=0

for commit in "${COMMITS[@]}"; do
    msg=$(git log -1 --format=%s "$commit" 2>/dev/null || echo "unknown")
    echo "Applying: $commit - $msg"

    # Try to cherry-pick
    if git cherry-pick "$commit" -n 2>/dev/null; then
        # Check if there are any changes
        if git diff --cached --quiet; then
            echo "⊘ No changes (already applied or not relevant)"
            git reset --hard HEAD
            ((SKIP_COUNT++))
        else
            # Commit the changes
            git commit --no-edit
            echo "✓ Applied successfully"
            ((SUCCESS_COUNT++))
        fi
    else
        # Cherry-pick failed - check if it's because it's already applied
        git reset --hard HEAD 2>/dev/null
        echo "⊘ Skipped (conflict or already applied)"
        ((SKIP_COUNT++))
    fi
    echo ""
done

echo "=== Cherry-pick Summary ==="
echo "✓ Successfully applied: $SUCCESS_COUNT"
echo "⊘ Skipped: $SKIP_COUNT"
echo ""
echo "miniAgent updated! Run 'git log --oneline -20' to see recent changes."
