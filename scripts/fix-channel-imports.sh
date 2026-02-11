#!/usr/bin/env bash
# Fix imports for removed channels in miniAgent

set -e

echo "🔧 Fixing channel imports for removed channels..."

# List of removed channels
REMOVED_CHANNELS=(
  "telegram"
  "slack"
  "signal"
  "imessage"
  "whatsapp"
  "line"
  "web"  # WhatsApp Web (channel-web.ts, src/web/, etc.)
)

# Find all TypeScript files (excluding node_modules, test files already removed)
echo "Scanning for imports..."

# Create backup
echo "Creating backup..."
cp -r src/ src-backup-before-import-fix/

echo "Removed channel directories and core files. Now fixing remaining imports..."
echo "This requires manual review of key files:"
echo "  - src/channels/dock.ts (channel registry)"
echo "  - src/channels/registry.ts (channel order)"
echo "  - src/plugins/runtime/index.ts (plugin loading)"
echo "  - src/infra/outbound/deliver.ts (outbound handlers)"

echo ""
echo "✅ Backup created at src-backup-before-import-fix/"
echo "⚠️  Manual fixes needed - see list above"
