#!/bin/bash
# Analyze commits from upstream and categorize them for cherry-picking

BASE_COMMIT="875324e7c"
UPSTREAM="upstream/main"

echo "=== ANALYZING COMMITS FROM $BASE_COMMIT TO $UPSTREAM ==="
echo ""

# Function to categorize a commit
categorize_commit() {
    local commit=$1
    local msg=$(git log -1 --format=%s "$commit")

    # EXCLUDE patterns
    if echo "$msg" | grep -qiE '(irc|matrix|telegram|slack|signal|imessage|feishu|line|whatsapp|browser|canvas|a2ui|macos|ios|testflight|^docs:|^chore:|changelog|^Docs:)'; then
        echo "EXCLUDE"
        return
    fi

    # INCLUDE patterns (high priority)
    if echo "$msg" | grep -qiE '(^fix\(|^fix:|security|discord|vulnerability)'; then
        echo "INCLUDE"
        return
    fi

    # REVIEW (needs manual decision)
    echo "REVIEW"
}

echo "### AUTO-INCLUDE (Bug fixes, security, Discord) ###"
git log --oneline --no-merges "$BASE_COMMIT..$UPSTREAM" | while read line; do
    commit=$(echo "$line" | awk '{print $1}')
    msg=$(echo "$line" | cut -d' ' -f2-)
    category=$(categorize_commit "$commit")

    if [ "$category" = "INCLUDE" ]; then
        echo "$commit $msg"
    fi
done

echo ""
echo "### AUTO-EXCLUDE (Channels, Browser, UI, Docs) ###"
git log --oneline --no-merges "$BASE_COMMIT..$UPSTREAM" | while read line; do
    commit=$(echo "$line" | awk '{print $1}')
    msg=$(echo "$line" | cut -d' ' -f2-)
    category=$(categorize_commit "$commit")

    if [ "$category" = "EXCLUDE" ]; then
        echo "$commit $msg"
    fi
done | head -20

echo "... (showing first 20 excluded)"
echo ""
echo "### REVIEW NEEDED ###"
git log --oneline --no-merges "$BASE_COMMIT..$UPSTREAM" | while read line; do
    commit=$(echo "$line" | awk '{print $1}')
    msg=$(echo "$line" | cut -d' ' -f2-)
    category=$(categorize_commit "$commit")

    if [ "$category" = "REVIEW" ]; then
        echo "$commit $msg"
    fi
done
