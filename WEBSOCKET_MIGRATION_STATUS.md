# Bun.serve WebSocket Migration - Implementation Status

**Date**: 2026-02-12
**Branch**: bun-websocket
**Status**: In Progress - Infrastructure Complete, Integration Remaining

## ✅ Completed Infrastructure

### 1. WebSocket Adapter (ws-adapter.ts)

- Created EventEmitter-based adapter
- Implements ws.WebSocket interface using Bun's ServerWebSocket
- Enables reuse of existing message handling logic

### 2. Bun Server (server-bun.ts)

- Bun.serve implementation with WebSocket support
- HTTP handler extension framework (httpHandlers array)
- Simplified, focused implementation

### 3. Message Handler Bridge (message-handler-bun.ts)

- Bridges Bun WebSocket to existing ws-package handler
- Creates adapter and delegates to attachGatewayWsMessageHandler
- Forwards messages/close events properly

### 4. Type Updates (ws-types.ts)

- GatewayWsClient.socket remains ws.WebSocket type (adapter implements it)
- GatewayWsData stores Bun-specific connection state
- Includes onMessage/onClose handlers

### 5. Bun Runtime State (server-runtime-state-bun.ts)

- Parallel implementation of createGatewayRuntimeState
- Uses createGatewayBunServer instead of HTTP + WebSocket servers
- Returns bunServer instead of httpServer/httpServers/wss

## ⏸️ Remaining Integration Work

### 1. Update server.impl.ts

**Location**: Line 331 - createGatewayRuntimeState call

**Changes needed**:

- Replace `createGatewayRuntimeState` with `createGatewayRuntimeStateBun`
- Update destructuring to get `bunServer` and `httpBindHost` instead of `httpServer`, `httpServers`, `httpBindHosts`
- Pass additional parameters: `logGateway`, `logHealth`, `logWsControl`, `gatewayMethods`, `events`, `buildRequestContext`

### 2. Remove/Update attachGatewayWsHandlers Call

**Location**: Line 472 - attachGatewayWsHandlers

**Changes needed**:

- This call is no longer needed (WebSocket handling is built into Bun.serve)
- Remove the call entirely
- WebSocket handlers are already attached in createGatewayBunServer

### 3. Update Close Handler

**Location**: Line 620 - createGatewayCloseHandler

**Changes needed**:

- Update to use `bunServer` instead of `wss`, `httpServer`, `httpServers`
- Bun server closing: `bunServer.stop()`
- Remove WebSocketServer and HTTP server closing logic

### 4. Update server-close.ts

**Update needed**: Add Bun server support

```typescript
// Add to createGatewayCloseHandler params
bunServer?: BunServer;

// In close handler, replace wss/httpServer closing with:
if (params.bunServer) {
  params.bunServer.stop();
} else {
  // Old path for backward compat
  await new Promise<void>((resolve) => params.wss.close(() => resolve()));
  // ... HTTP server closing
}
```

## 🧪 Testing Plan

### 1. Basic Connectivity

- Start gateway with Bun server
- Connect with WebSocket client
- Verify handshake completes
- Verify messages are exchanged

### 2. HTTP Routes

- Test hooks endpoint
- Test plugin endpoints
- Test OpenAI compat endpoint (if enabled)
- Test Control UI (if enabled)

### 3. WebSocket Features

- Test broadcast (agent events)
- Test targeted broadcast (connIds)
- Test slow consumer handling (bufferedAmount)
- Test connection timeout
- Test authentication

### 4. Performance Benchmarking

- Measure startup time
- Measure memory usage (idle)
- Compare to baseline metrics

## 📊 Expected Performance

**Baseline (ws package)**:

- Startup: 1583ms
- Memory: 310MB

**Target (Bun.serve)**:

- Startup: <1500ms (5% improvement or maintain)
- Memory: <300MB (3% improvement)
- WebSocket throughput: Higher (Bun native)

## 🎯 Next Steps

1. **Complete server.impl.ts integration** (~30-50 lines of changes)
2. **Update server-close.ts** (~10-20 lines of changes)
3. **Build and fix TypeScript errors** (iterative)
4. **Test gateway startup** (verify listening)
5. **Test WebSocket connection** (use Control UI or CLI client)
6. **Test message handling** (agent messages)
7. **Benchmark performance**
8. **Update BUN_COMPATIBILITY.md** with results

## 📝 Implementation Notes

### Architecture Decision: Adapter Pattern

- Chose adapter pattern over full rewrite
- Enables reuse of ~1000 lines of existing handshake/message logic
- Reduces risk of bugs in complex authentication flow
- Trade-off: Slight overhead from adapter layer (negligible)

### Why Parallel Function vs In-Place Migration

- `createGatewayRuntimeStateBun` created as parallel export
- Allows staged migration without breaking existing code
- Return type differs (bunServer vs httpServer/wss)
- Clean separation of concerns

### HTTP Handler Integration

- Current: Minimal (404 for most requests)
- TODO: Integrate existing HTTP handlers (hooks, plugins, OpenAI, etc.)
- Approach: Convert IncomingMessage/ServerResponse to Request/Response via adapters

## 🚧 Known Limitations

1. **Multi-host binding**: Currently single bind host (can extend later)
2. **HTTP handlers**: Minimal implementation (TODO: add full suite)
3. **Canvas WebSocket**: Not yet implemented (returns 501)
4. **bufferedAmount**: Not exposed by Bun (estimated as 0 for now)

## ⚠️ Migration Risks

### Medium Risk

- Type mismatches between adapter and ws.WebSocket interface
- HTTP handler compatibility (IncomingMessage vs Request)
- Subtle behavior differences in WebSocket close/error handling

### Mitigation

- Comprehensive testing before deployment
- Keep backup tag for rollback
- Monitor errors/crashes carefully in first hour
- Compare behavior with baseline (ws package)

## 📚 Files Modified

**Created**:

- src/gateway/server/ws-adapter.ts
- src/gateway/server-bun.ts
- src/gateway/server/ws-connection/message-handler-bun.ts
- src/gateway/server-runtime-state-bun.ts
- src/gateway/server-bun.ts.backup (complex version)

**Modified**:

- src/gateway/server/ws-types.ts

**To Modify**:

- src/gateway/server.impl.ts
- src/gateway/server-close.ts

**Potentially Remove** (after migration):

- src/gateway/server-http.ts (HTTP creation logic)
- src/gateway/server-ws-runtime.ts (thin wrapper)
- src/gateway/server/ws-connection.ts (old connection handler)

---

**Estimated Remaining Time**: 2-3 hours

- Integration: 1 hour
- Testing/debugging: 1-2 hours
- Documentation update: 30 min
