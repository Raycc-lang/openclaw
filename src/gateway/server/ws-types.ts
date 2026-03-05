import type { WebSocket } from "ws";
import type { ConnectParams } from "../protocol/index.js";

export type GatewayWsClient = {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  presenceKey?: string;
  clientIp?: string;
  canvasHostUrl?: string;
  canvasCapability?: string;
  canvasCapabilityExpiresAtMs?: number;
};

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
  handshakeTimer?: ReturnType<typeof setTimeout>;
  connectNonce: string;
  remoteAddr?: string;
  requestHost?: string;
  requestOrigin?: string;
  requestUserAgent?: string;
  forwardedFor?: string;
  realIp?: string;
  onMessage?: (text: string) => void;
  onClose?: (code: number, reason: string) => void;
};
