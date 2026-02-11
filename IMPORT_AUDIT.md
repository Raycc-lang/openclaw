# Import Dependency Audit - Removed Channels

## miniAgent Channel Cleanup

**Date**: 2026-02-11
**Status**: Ready for batch cleanup
**Affected Files**: 43

---

## Summary

After removing source directories for non-Discord channels, **43 files** still contain import statements referencing the removed channels. These imports will cause compilation errors and must be cleaned up.

**Removed Channels**:

- telegram (`src/telegram/`)
- slack (`src/slack/`)
- signal (`src/signal/`)
- imessage (`src/imessage/`)
- whatsapp (`src/whatsapp/`, `src/web/`)
- line (`src/line/`)

**Kept Channels**:

- ✅ discord (`src/discord/`)
- ✅ googlechat (plugin)

---

## Strategy

### Approach Options:

**Option 1: Stub Functions (Recommended)**

- Create stub implementations that throw "Channel not available" errors
- Allows code to compile
- Runtime errors only if user tries to use removed channels
- Minimal code changes
- **Effort**: ~30min

**Option 2: Remove All References**

- Delete or comment out all functionality related to removed channels
- Clean but may break features that expect multi-channel support
- **Effort**: ~2 hours

**Option 3: Conditional Compilation**

- Wrap removed channel code in feature flags
- Preserves code for future re-enabling
- **Effort**: ~1 hour

**Recommendation**: Option 1 (Stubs) - fastest path to working build.

---

## Affected Files by Category

### Category 1: Core Channel Infrastructure (12 files)

**High Priority - Blocks compilation**

1. `src/channels/dock.ts` - ⚠️ **PARTIALLY FIXED**
   - Imports removed, but DOCKS object still has telegram/whatsapp/slack/signal/imessage entries
   - **Fix**: Remove all channel entries except discord and googlechat

2. `src/channels/plugins/group-mentions.ts`
   - Imports functions for all removed channels
   - **Fix**: Keep only discord and googlechat functions

3. `src/channels/plugins/directory-config.ts`
   - Channel-specific config handlers
   - **Fix**: Remove all non-discord channel handlers

4. `src/channels/plugins/normalize/*.ts` (3 files)
   - imessage.ts, slack.ts, whatsapp.ts
   - **Fix**: Delete these files entirely

5. `src/channels/plugins/onboarding/*.ts` (4 files)
   - imessage.ts, signal.ts, slack.ts, telegram.ts, whatsapp.ts
   - **Fix**: Delete these files entirely

6. `src/channels/plugins/outbound/*.ts` (5 files)
   - imessage.ts, signal.ts, slack.ts, telegram.ts, whatsapp.ts
   - **Fix**: Delete these files entirely

7. `src/channels/plugins/actions/*.ts` (2 files)
   - signal.ts, telegram.ts
   - **Fix**: Delete these files entirely

8. `src/channels/plugins/slack.actions.ts`
   - **Fix**: Delete this file

### Category 2: Plugin System (2 files)

**High Priority - Core functionality**

9. `src/plugin-sdk/index.ts`
   - Exports for all channels (telegram, slack, signal, imessage, whatsapp, line)
   - ~100 export lines for removed channels
   - **Fix**: Remove all exports for removed channels

10. `src/plugins/runtime/index.ts`
    - Plugin registration for all channels
    - Imports monitors, probes, send functions
    - **Fix**: Remove all channel registrations except discord

### Category 3: Outbound Messaging (3 files)

**High Priority - Send message functionality**

11. `src/infra/outbound/deliver.ts`
    - Type imports for send functions: sendMessageTelegram, sendMessageSlack, etc.
    - OutboundSendDeps interface
    - **Fix**: Keep only sendDiscord in OutboundSendDeps

12. `src/infra/outbound/outbound-session.ts`
    - Channel-specific parsing and account resolution
    - Imports from telegram, slack, signal, imessage, whatsapp
    - **Fix**: Remove all channel-specific logic except discord

13. `src/infra/outbound/message-action-runner.ts`
    - Target parsing for slack, telegram
    - Media loading from whatsapp/web
    - **Fix**: Remove slack/telegram target parsing

### Category 4: Gateway & HTTP (1 file)

**Medium Priority**

14. `src/gateway/server-http.ts`
    - Slack HTTP endpoint handler
    - **Fix**: Remove slack HTTP handler

### Category 5: Agent Tools (6 files)

**Medium Priority - Tool functionality**

15. `src/agents/tools/slack-actions.ts`
    - **Fix**: Delete file or stub out

16. `src/agents/tools/telegram-actions.ts`
    - **Fix**: Delete file or stub out

17. `src/agents/tools/whatsapp-actions.ts`
    - **Fix**: Delete file or stub out

18. `src/agents/tools/image-tool.ts`
    - Uses web media loading
    - **Fix**: Remove web media dependency or replace with discord media

19. `src/agents/pi-embedded-runner/compact.ts`
    - Telegram/signal reaction levels and inline buttons
    - **Fix**: Remove telegram/signal specific code

20. `src/agents/pi-embedded-runner/run/attempt.ts`
    - Same as compact.ts
    - **Fix**: Remove telegram/signal specific code

21. `src/agents/pi-embedded-runner/run/images.ts`
    - Web media loading
    - **Fix**: Replace with discord media or remove

### Category 6: Auto-Reply Engine (6 files)

**Medium Priority - Reply processing**

22. `src/auto-reply/reply/commands-allowlist.ts`
    - Account resolvers for all channels
    - **Fix**: Keep only discord

23. `src/auto-reply/reply/commands-models.ts`
    - Telegram model buttons
    - **Fix**: Remove telegram buttons

24. `src/auto-reply/reply/directive-handling.model.ts`
    - Telegram browse providers button
    - **Fix**: Remove telegram button

25. `src/auto-reply/reply/line-directives.ts`
    - **Fix**: Delete file

26. `src/auto-reply/reply/normalize-reply.ts`
    - Uses line directives
    - **Fix**: Remove line directive handling

27. `src/auto-reply/templating.ts`
    - Telegram sticker metadata type
    - **Fix**: Remove telegram type import

### Category 7: Discord Channel (3 files)

**Low Priority - Discord uses removed channel utils**

28. `src/discord/send.emojis-stickers.ts`
    - Uses web media loading
    - **Fix**: Replace with discord-specific media loading

29. `src/discord/send.shared.ts`
    - Uses web media loading
    - **Fix**: Replace with discord-specific media loading

30. `src/discord/monitor/native-command.ts`
    - Uses web media loading
    - **Fix**: Replace with discord-specific media loading

### Category 8: Configuration (2 files)

**Low Priority**

31. `src/config/plugin-auto-enable.ts`
    - WhatsApp auth check
    - **Fix**: Remove whatsapp auth check

32. `src/config/zod-schema.providers-core.ts`
    - Telegram custom commands schema
    - **Fix**: Remove telegram schema

33. `src/commands/channels/capabilities.ts`
    - Slack scopes fetching
    - **Fix**: Remove slack capabilities

---

## Detailed Import Counts

```
telegram: 25 imports
slack: 18 imports
signal: 11 imports
imessage: 10 imports
whatsapp: 15 imports (including web/)
line: 8 imports
web/: 12 imports (WhatsApp Web)
```

**Total**: ~99 import statements across 43 files

---

## Recommended Fix Order

### Phase 1: Core Infrastructure (30 min)

1. ✅ `src/channels/registry.ts` - DONE
2. ⚠️ `src/channels/dock.ts` - Fix DOCKS object (remove all except discord/googlechat)
3. `src/channels/plugins/group-mentions.ts` - Remove non-discord functions
4. Delete `src/channels/plugins/normalize/*.ts` (except discord if exists)
5. Delete `src/channels/plugins/onboarding/*.ts` (except discord if exists)
6. Delete `src/channels/plugins/outbound/*.ts` (except discord if exists)
7. Delete `src/channels/plugins/actions/*.ts`
8. Delete `src/channels/plugins/slack.actions.ts`

### Phase 2: Plugin System (20 min)

9. `src/plugin-sdk/index.ts` - Remove all channel exports except discord
10. `src/plugins/runtime/index.ts` - Remove all channel registrations except discord

### Phase 3: Outbound/Messaging (20 min)

11. ✅ `src/cli/deps.ts` - DONE
12. ✅ `src/index.ts` - DONE
13. `src/infra/outbound/deliver.ts` - Update OutboundSendDeps
14. `src/infra/outbound/outbound-session.ts` - Remove channel logic
15. `src/infra/outbound/message-action-runner.ts` - Remove channel parsing

### Phase 4: Cleanup Remaining (30 min)

16-33. Delete tool files, update auto-reply, fix config

---

## Testing Strategy

After fixes:

```bash
# 1. Check no import errors
bun src/index.ts daemon --help

# 2. Type check
tsc --noEmit

# 3. Verify discord still works
bun src/index.ts channels status

# 4. Test autonomy features
# (cron, heartbeat, memory should be unaffected)
```

---

## Next Steps

**Awaiting your approval to proceed with:**

1. Phase 1-4 batch fixes (~90 minutes total)
2. Commit after each phase for rollback capability
3. Final testing

**Alternative**: If you want to review specific files first, let me know which category to start with.

---

## Files to Delete Entirely (21 files)

These have no value after channel removal:

```bash
# Normalize
src/channels/plugins/normalize/imessage.ts
src/channels/plugins/normalize/slack.ts
src/channels/plugins/normalize/whatsapp.ts
src/channels/plugins/normalize/telegram.ts (if exists)
src/channels/plugins/normalize/signal.ts (if exists)

# Onboarding
src/channels/plugins/onboarding/imessage.ts
src/channels/plugins/onboarding/signal.ts
src/channels/plugins/onboarding/slack.ts
src/channels/plugins/onboarding/telegram.ts
src/channels/plugins/onboarding/whatsapp.ts

# Outbound
src/channels/plugins/outbound/imessage.ts
src/channels/plugins/outbound/signal.ts
src/channels/plugins/outbound/slack.ts
src/channels/plugins/outbound/telegram.ts
src/channels/plugins/outbound/whatsapp.ts

# Actions
src/channels/plugins/actions/signal.ts
src/channels/plugins/actions/telegram.ts
src/channels/plugins/slack.actions.ts

# Tools
src/agents/tools/slack-actions.ts
src/agents/tools/telegram-actions.ts
src/agents/tools/whatsapp-actions.ts

# Auto-reply
src/auto-reply/reply/line-directives.ts
```

---

**Ready to proceed?** Say "go" and I'll execute all 4 phases systematically with git commits after each.
