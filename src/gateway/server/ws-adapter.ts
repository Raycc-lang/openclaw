/**
 * Adapter to make Bun's ServerWebSocket work with existing ws-package-based code
 */

import type { ServerWebSocket } from "bun";
import { EventEmitter } from "node:events";
import type { GatewayWsData } from "./ws-types.js";

/**
 * Create a ws-package-compatible WebSocket wrapper around Bun's ServerWebSocket
 */
export function createWsAdapter(bunWs: ServerWebSocket<GatewayWsData>): WebSocketAdapter {
  const adapter = new WebSocketAdapter(bunWs);
  return adapter;
}

/**
 * WebSocket adapter that implements the ws package interface using Bun's ServerWebSocket
 */
class WebSocketAdapter extends EventEmitter {
  constructor(private bunWs: ServerWebSocket<GatewayWsData>) {
    super();
  }

  send(data: string, callback?: (err?: Error) => void) {
    try {
      this.bunWs.send(data);
      callback?.();
    } catch (err) {
      callback?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  close(code?: number, reason?: string) {
    this.bunWs.close(code, reason);
  }

  get bufferedAmount(): number {
    // Bun doesn't expose bufferedAmount directly, estimate as 0 for now
    // TODO: Track this manually if needed for backpressure
    return 0;
  }

  get readyState(): number {
    // Bun doesn't expose readyState, assume OPEN (1) if socket exists
    return 1;
  }

  // Internal method called by message-handler-bun.ts
  _handleMessage(text: string) {
    this.emit("message", text);
  }

  _handleClose(code: number, reason: string) {
    this.emit("close", code, reason);
  }

  _handleError(err: Error) {
    this.emit("error", err);
  }

  // Expose the underlying Bun socket for direct access if needed
  get _bunWs(): ServerWebSocket<GatewayWsData> {
    return this.bunWs;
  }
}
