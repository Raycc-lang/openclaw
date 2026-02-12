/**
 * Bun.serve gateway server implementation
 * Simplified version focusing on WebSocket with minimal HTTP handling
 */

import type { Server, ServerWebSocket, TLSOptions } from "bun";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./server-methods/types.js";
import type { GatewayWsClient, GatewayWsData } from "./server/ws-types.js";
import { CANVAS_WS_PATH } from "../canvas-host/a2ui.js";
import { getHandshakeTimeoutMs } from "./server-constants.js";
import { createWsAdapter } from "./server/ws-adapter.js";
import { attachGatewayWsMessageHandler } from "./server/ws-connection/message-handler-bun.js";
import { logWs } from "./ws-log.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

/**
 * HTTP request handler type for compatibility with existing handlers
 */
export type HttpRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

/**
 * Create minimal IncomingMessage stub from Bun Request
 */
function createIncomingMessageStub(req: Request, remoteAddr?: string): IncomingMessage {
  const url = new URL(req.url);
  return {
    headers: Object.fromEntries(req.headers.entries()),
    url: url.pathname + url.search,
    method: req.method,
    socket: {
      remoteAddress: remoteAddr,
    } as any,
  } as any;
}

/**
 * Create minimal ServerResponse stub that collects response data
 */
class ServerResponseStub {
  statusCode = 200;
  private _headers: Record<string, string> = {};
  private _body: string = "";
  private _ended = false;

  setHeader(name: string, value: string) {
    this._headers[name] = value;
  }

  end(data?: string) {
    if (data) {
      this._body += data;
    }
    this._ended = true;
  }

  toResponse(): Response {
    return new Response(this._body, {
      status: this.statusCode,
      headers: this._headers,
    });
  }

  get ended(): boolean {
    return this._ended;
  }
}

/**
 * Adapt node:http style handler to Bun Request/Response
 */
async function adaptHttpHandler(
  req: Request,
  handler: HttpRequestHandler,
  remoteAddr?: string,
): Promise<Response | null> {
  const reqStub = createIncomingMessageStub(req, remoteAddr);
  const resStub = new ServerResponseStub();

  const handled = await handler(reqStub, resStub as any);
  if (!handled || !resStub.ended) {
    return null;
  }

  return resStub.toResponse();
}

export interface BunServerOptions {
  bindHost: string;
  port: number;
  clients: Set<GatewayWsClient>;
  resolvedAuth: ResolvedGatewayAuth;
  tlsOptions?: TLSOptions;
  gatewayHost?: string;
  canvasHostEnabled: boolean;
  canvasHostServerPort?: number;
  gatewayMethods: string[];
  events: string[];
  logGateway: SubsystemLogger;
  logHealth: SubsystemLogger;
  logWsControl: SubsystemLogger;
  extraHandlersRef: { current: any };
  broadcast: (
    event: string,
    payload: unknown,
    opts?: {
      dropIfSlow?: boolean;
      stateVersion?: { presence?: number; health?: number };
    },
  ) => void;
  buildRequestContext: () => GatewayRequestContext;
  // Optional HTTP request handlers (can be added incrementally)
  httpHandlers?: HttpRequestHandler[];
}

export function createGatewayBunServer(opts: BunServerOptions): Server<GatewayWsData> {
  const {
    bindHost,
    port,
    clients,
    resolvedAuth,
    tlsOptions,
    gatewayHost,
    canvasHostEnabled,
    canvasHostServerPort,
    gatewayMethods,
    events,
    logGateway,
    logHealth,
    logWsControl,
    extraHandlersRef,
    broadcast,
    buildRequestContext,
    httpHandlers = [],
  } = opts;

  const server = Bun.serve<GatewayWsData>({
    port,
    hostname: bindHost,
    tls: tlsOptions,

    fetch(req, server) {
      const url = new URL(req.url);

      // Try WebSocket upgrade
      if (req.headers.get("upgrade") === "websocket") {
        // Check if canvas WebSocket (skip for now, handle gateway WS only)
        if (url.pathname === CANVAS_WS_PATH) {
          // TODO: Implement canvas WebSocket if needed
          return new Response("Canvas WebSocket not yet implemented", { status: 501 });
        }

        // Gateway WebSocket upgrade
        const remoteAddr = server.requestIP(req)?.address;
        const success = server.upgrade(req, {
          data: {
            connId: randomUUID(),
            openedAt: Date.now(),
            handshakeState: "pending" as const,
            connectNonce: randomUUID(),
            remoteAddr,
            requestHost: req.headers.get("host") ?? undefined,
            requestOrigin: req.headers.get("origin") ?? undefined,
            requestUserAgent: req.headers.get("user-agent") ?? undefined,
            forwardedFor: req.headers.get("x-forwarded-for") ?? undefined,
            realIp: req.headers.get("x-real-ip") ?? undefined,
          },
        });

        if (success) {
          return; // Upgrade successful, will be handled by websocket.open
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Try HTTP handlers
      const remoteAddr = server.requestIP(req)?.address;
      return (async () => {
        for (const handler of httpHandlers) {
          const response = await adaptHttpHandler(req, handler, remoteAddr);
          if (response) {
            return response;
          }
        }
        // No handler matched
        return new Response("Not Found", { status: 404 });
      })();
    },

    websocket: {
      open(ws: ServerWebSocket<GatewayWsData>) {
        const data = ws.data;
        const { connId } = data;

        logWs("in", "open", { connId, remoteAddr: data.remoteAddr });

        // Create adapter to make Bun WebSocket compatible with ws package
        const wsAdapter = createWsAdapter(ws);

        // Send connect challenge
        wsAdapter.send(
          JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: data.connectNonce, ts: Date.now() },
          }),
        );

        // Set handshake timeout
        const handshakeTimeoutMs = getHandshakeTimeoutMs();
        const handshakeTimer = setTimeout(() => {
          if (!data.client) {
            data.handshakeState = "failed";
            data.closeCause = "handshake-timeout";
            data.closeMeta = { handshakeMs: Date.now() - data.openedAt };
            logWsControl.warn(`handshake timeout conn=${connId} remote=${data.remoteAddr ?? "?"}`);
            ws.close(1000, "handshake timeout");
          }
        }, handshakeTimeoutMs);

        data.handshakeTimer = handshakeTimer;

        // Attach message handler (this will set up data.onMessage and data.onClose)
        attachGatewayWsMessageHandler({
          ws,
          clients,
          resolvedAuth,
          gatewayMethods,
          events,
          extraHandlers: extraHandlersRef.current,
          buildRequestContext,
          gatewayHost,
          canvasHostEnabled,
          canvasHostServerPort,
          port,
          logGateway,
          logHealth,
          logWsControl,
          broadcast,
        });
      },

      message(ws: ServerWebSocket<GatewayWsData>, message: string | Buffer) {
        const text = typeof message === "string" ? message : message.toString("utf-8");
        // Delegate to handler set up in open()
        ws.data.onMessage?.(text);
      },

      close(ws: ServerWebSocket<GatewayWsData>, code: number, reason: string) {
        const data = ws.data;

        if (data.handshakeTimer) {
          clearTimeout(data.handshakeTimer);
        }

        if (data.client) {
          clients.delete(data.client);
        }

        // Delegate to handler set up in open()
        data.onClose?.(code, reason);
      },

      drain(ws: ServerWebSocket<GatewayWsData>) {
        // Called when bufferedAmount reaches zero after being > 0
        // Useful for backpressure management
      },
    },
  });

  return server;
}
