#!/bin/bash
# Auto-cherry-pick critical commits for miniAgent

set -e

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
    "b75d61808" # fix(doctor): suppress repeated legacy state migration warnings
    "db137dd65" # fix(paths): respect OPENCLAW_HOME for all internal path resolution
    "eed580d31" # fix(config): clamp maxTokens to contextWindow to prevent invalid configurations
    "456bd5874" # fix(paths): structurally resolve home dir to prevent Windows path bugs
    "5ac1be9cb" # fix: all bundled hooks broken since 2026.2.2 (tsdown migration)
    "8d96955e1" # fix(routing): make bindings dynamic by calling loadConfig() per-message
    "6ed255319" # fix(skills): ignore Python venvs and caches in skills watcher
    "07375a65d" # fix(cron): recover flat params when LLM omits job wrapper
    "5f2ad938a" # fix(tools): include provider-specific settings in web search cache key
    "71b4be879" # fix: handle 400 status in failover to enable model fallback
    "c984e6d8d" # fix: prevent false positive context overflow detection in conversation text
    "588d7133f" # fix(docs): correct wake command in coding-agent skill
    "512b2053c" # fix(web_search): Fix invalid model name sent to Perplexity
    "394d60c1f" # fix(onboarding): auto-install shell completion in QuickStart
    "3e63b2a4f" # fix(cli): improve plugins list source display
    "ec55583bb" # fix: align extension tests and fetch typing for gate stability
    "268094938" # fix: reduce brew noise in onboarding
    "1fad19008" # fix: improve code-size gate output and duplicate detection, fix Windows path
    "97b3ee7ec" # Fix: Honor `/think off` for reasoning-capable models
    "ead3bb645" # discord: auto-create thread when sending to Forum/Media channels
    "d3c71875e" # fix: cap Discord gateway reconnect at 50 attempts to prevent infinite loop
    "c2b2d535f" # fix: suggest /clear in context overflow error message
    "c4d9b6ead" # fix: docs broken links and improve link checker
    "0c7bc303c" # fix(tools): correct Grok response parsing for xAI Responses API
    "757522fb4" # fix(memory): default batch embeddings to off
    "e19a23520" # fix: unify session maintenance and cron run pruning
    "137b7d9aa" # fix(ui): prioritize displayName over label in webchat session picker
    "f17c978f5" # refactor(security,config): split oversized files
    "4537ebc43" # fix: enforce Discord agent component DM auth
    "8ff1618bf" # Discord: add exec approval cleanup option
    "53273b490" # fix(auto-reply): prevent sender spoofing in group prompts
    "40919b1fc" # fix(test): add StringSelectMenu to @buape/carbon mock
    "ef4a0e92b" # fix(memory/qmd): scope query to managed collections
    "d2f5d45f0" # fix(credits): deduplicate contributors by GitHub username and display name
    "6731c6a1c" # fix(docker): support Bash 3.2 in docker-setup.sh
    "67d25c653" # fix: strip reasoning tags from messaging tool text to prevent <think> leakage
    "22458f57f" # fix(agents): strip [Historical context: ...] and tool call text from streaming path
    "c4d3800c2" # fix: resolve message tool lint error
    "88428260c" # fix(web_search): remove unsupported include param from Grok API calls
    "74273d62d" # fix(pairing): show actual code in approval command instead of placeholder
    "a853ded78" # fix(pairing): use actual code in pairing approval text
    "841dbeee0" # fix(ui): coerce form values to schema types before config.set
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
CONFLICT_COUNT=0
SKIPPED_COUNT=0

for commit in "${COMMITS[@]}"; do
    msg=$(git log -1 --format=%s "$commit")
    echo "Cherry-picking: $commit - $msg"

    if git cherry-pick "$commit" 2>&1; then
        echo "✓ Success"
        ((SUCCESS_COUNT++))
    else
        # Check if conflict or already applied
        if git status | grep -q "nothing to commit"; then
            echo "⊘ Already applied (skipped)"
            git cherry-pick --abort 2>/dev/null || true
            ((SKIPPED_COUNT++))
        else
            echo "✗ CONFLICT - needs manual resolution"
            echo "  To resolve: fix conflicts, then run: git cherry-pick --continue"
            echo "  To skip: git cherry-pick --skip"
            ((CONFLICT_COUNT++))
            exit 1
        fi
    fi
    echo ""
done

echo "=== Cherry-pick Summary ==="
echo "✓ Successful: $SUCCESS_COUNT"
echo "⊘ Skipped: $SKIPPED_COUNT"
echo "✗ Conflicts: $CONFLICT_COUNT"
echo ""
echo "miniAgent is now updated with critical bug fixes from upstream!"
