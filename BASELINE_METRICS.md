# Phase 2 Baseline Metrics

**Date**: 2026-02-12
**Version**: 2026.2.10-miniAgent
**Runtime**: Bun (with Node.js APIs)

## Performance

- **Startup time**: 1675ms (average of 10 runs)
- **Memory (idle)**: 308MB RSS
- **Gateway starts**: ✅ Working
- **Gateway port**: 18789
- **Gateway PID**: 320686 (currently running)

## Baseline Details

### Startup Time Measurements (10 runs)

```
Run 1: 1839ms
Run 2: 1823ms
Run 3: 1630ms
Run 4: 1670ms
Run 5: 1628ms
Run 6: 1637ms
Run 7: 1562ms
Run 8: 1633ms
Run 9: 1635ms
Run 10: 1690ms
Average: 1675ms
```

### Memory Measurement

- RSS: 308MB (316028KB)
- VSZ: 74408180KB
- Process: bun src/index.ts gateway

## Autonomy (Pre-Migration)

- **Gateway startup**: ✅ Successful
- **WebSocket server**: ✅ Listening on ws://127.0.0.1:18789
- **Web UI connections**: ✅ Working (webchat connections observed)
- **Heartbeat**: Disabled (per configuration)
- **Cron jobs**: [To be tested during migration]
- **Webhooks**: [To be tested during migration]

## Known Issues

- Version warning: "Config was last written by a newer OpenClaw (2026.2.9); current version is 0.0.0"
  - Non-critical, doesn't affect functionality
- Plugin load error: qwen-portal-auth extension failed to load
  - ParseError in plugin loading, but gateway still starts and runs

## Phase 2 Targets

| Metric         | Baseline  | Target             | Gap                       |
| -------------- | --------- | ------------------ | ------------------------- |
| Startup time   | 1675ms    | <1000ms            | Need 40% reduction        |
| Memory (idle)  | 308MB     | <300MB             | Need 8MB reduction (2.6%) |
| Gateway uptime | ✅ Stable | No crashes in 24hr | TBD                       |

## Notes

This baseline will be compared against post-migration metrics to measure Phase 2 improvements.

The current implementation uses:

- WebSocket: `ws` package (Node-style)
- File I/O: `fs/promises` (Node-style)
- HTTP: Express or similar (to be confirmed)
- SQLite: better-sqlite3 (to be confirmed)
