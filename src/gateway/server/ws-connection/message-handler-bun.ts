/**
 * Bun WebSocket message handler adapter
 * Bridges Bun's ServerWebSocket to the existing ws-package-based message handler
 */

import type { ServerWebSocket } from "bun";
import type { IncomingMessage } from "node:http";
import type { createSubsystemLogger } from "../../../logging/subsystem.js";
import type { ResolvedGatewayAuth } from "../../auth.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "../../server-methods/types.js";
import type { GatewayWsClient, GatewayWsData } from "../ws-types.js";
import { createWsAdapter } from "../ws-adapter.js";
import { attachGatewayWsMessageHandler as attachOriginalHandler } from "./message-handler.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

/**
 * Attach WebSocket message handler to a Bun ServerWebSocket
 * This creates an adapter and delegates to the existing ws-package-based handler
 */
export function attachGatewayWsMessageHandler(params: {
  ws: ServerWebSocket<GatewayWsData>;
  clients: Set<GatewayWsClient>;
  resolvedAuth: ResolvedGatewayAuth;
  gatewayMethods: string[];
  events: string[];
  extraHandlers: GatewayRequestHandlers;
  buildRequestContext: () => GatewayRequestContext;
  gatewayHost?: string;
  canvasHostEnabled: boolean;
  canvasHostServerPort?: number;
  port: number;
  logGateway: SubsystemLogger;
  logHealth: SubsystemLogger;
  logWsControl: SubsystemLogger;
  broadcast: (
    event: string,
    payload: unknown,
    opts?: {
      dropIfSlow?: boolean;
      stateVersion?: { presence?: number; health?: number };
    },
  ) => void;
}) {
  const {
    ws,
    clients,
    resolvedAuth,
    gatewayMethods,
    events,
    extraHandlers,
    buildRequestContext,
    gatewayHost,
    canvasHostEnabled,
    canvasHostServerPort,
    port,
    logGateway,
    logHealth,
    logWsControl,
    broadcast,
  } = params;

  const data = ws.data;
  const { connId, remoteAddr, requestHost, requestOrigin, requestUserAgent, forwardedFor, realIp } =
    data;

  // Create adapter that implements ws.WebSocket interface
  const wsAdapter = createWsAdapter(ws);

  // Create stub IncomingMessage for compatibility
  const upgradeReq: Partial<IncomingMessage> = {
    headers: {
      host: requestHost,
      origin: requestOrigin,
      "user-agent": requestUserAgent,
      "x-forwarded-for": forwardedFor,
      "x-real-ip": realIp,
    } as any,
    url: "/",
    socket: {
      remoteAddress: remoteAddr,
      localAddress: undefined,
    } as any,
  };

  // Helper functions that integrate with the adapter
  const send = (obj: unknown) => {
    wsAdapter.send(JSON.stringify(obj));
  };

  const close = (code = 1000, reason?: string) => {
    if (data.handshakeTimer) {
      clearTimeout(data.handshakeTimer);
      data.handshakeTimer = undefined;
    }
    if (data.client) {
      clients.delete(data.client);
    }
    wsAdapter.close(code, reason);
  };

  const isClosed = () => {
    return wsAdapter.readyState !== 1; // 1 = OPEN
  };

  const clearHandshakeTimer = () => {
    if (data.handshakeTimer) {
      clearTimeout(data.handshakeTimer);
      data.handshakeTimer = undefined;
    }
  };

  const getClient = () => data.client ?? null;

  const setClient = (client: GatewayWsClient) => {
    data.client = client;
    clients.add(client);
  };

  const setHandshakeState = (state: "pending" | "connected" | "failed") => {
    data.handshakeState = state;
  };

  const setCloseCause = (cause: string, meta?: Record<string, unknown>) => {
    if (!data.closeCause) {
      data.closeCause = cause;
    }
    if (meta && Object.keys(meta).length > 0) {
      data.closeMeta = { ...data.closeMeta, ...meta };
    }
  };

  const setLastFrameMeta = (meta: { type?: string; method?: string; id?: string }) => {
    if (meta.type || meta.method || meta.id) {
      data.lastFrameType = meta.type ?? data.lastFrameType;
      data.lastFrameMethod = meta.method ?? data.lastFrameMethod;
      data.lastFrameId = meta.id ?? data.lastFrameId;
    }
  };

  // Call the existing message handler with our adapter
  attachOriginalHandler({
    socket: wsAdapter as any, // Cast to ws.WebSocket type
    upgradeReq: upgradeReq as IncomingMessage,
    connId,
    remoteAddr,
    forwardedFor,
    realIp,
    requestHost,
    requestOrigin,
    requestUserAgent,
    canvasHostUrl: undefined, // Will be calculated inside original handler
    connectNonce: data.connectNonce,
    resolvedAuth,
    gatewayMethods,
    events,
    extraHandlers,
    buildRequestContext,
    send,
    close,
    isClosed,
    clearHandshakeTimer,
    getClient,
    setClient,
    setHandshakeState,
    setCloseCause,
    setLastFrameMeta,
    logGateway,
    logHealth,
    logWsControl,
  });

  // Set up message forwarding from Bun to adapter
  data.onMessage = (text: string) => {
    wsAdapter._handleMessage(text);
  };

  // Set up close forwarding
  data.onClose = (code: number, reason: string) => {
    wsAdapter._handleClose(code, reason);
  };
}
