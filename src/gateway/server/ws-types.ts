import type { WebSocket } from "ws";
import type { ConnectParams } from "../protocol/index.js";

/**
 * Gateway WebSocket client
 * When using Bun, socket will be a ws-compatible adapter wrapping ServerWebSocket
 */
export type GatewayWsClient = {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  presenceKey?: string;
  clientIp?: string;
};

/**
 * Data stored on each Bun WebSocket connection
 * This is attached to ServerWebSocket<GatewayWsData>.data
 */
export type GatewayWsData = {
  connId: string;
  openedAt: number;
  client?: GatewayWsClient;
  handshakeState: "pending" | "connected" | "failed";
  closeCause?: string;
  closeMeta?: Record<string, unknown>;
  lastFrameType?: string;
  lastFrameMethod?: string;
  lastFrameId?: string;
  handshakeTimer?: Timer;
  connectNonce: string;
  // Bun connection metadata
  remoteAddr?: string;
  requestHost?: string;
  requestOrigin?: string;
  requestUserAgent?: string;
  forwardedFor?: string;
  realIp?: string;
  // Message/close handlers
  onMessage?: (text: string) => void;
  onClose?: (code: number, reason: string) => void;
};
