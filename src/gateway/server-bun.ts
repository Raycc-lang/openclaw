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
 * Minimal ServerResponse interface that supports both buffered and streaming responses
 */
interface MinimalServerResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  write(chunk: string | Buffer): boolean;
  end(data?: string | Buffer): void;
  flushHeaders?(): void;
  readonly headersSent: boolean;
  readonly ended: boolean;
}

/**
 * HTTP request handler type for compatibility with existing handlers
 */
export type HttpRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

/**
 * Create minimal IncomingMessage stub from Bun Request
 * Supports client disconnection detection via request.signal
 */
function createIncomingMessageStub(req: Request, remoteAddr?: string): IncomingMessage {
  const url = new URL(req.url);

  // Create a simple EventEmitter-like close handler
  const closeHandlers: Array<() => void> = [];

  // Detect client disconnection via AbortSignal
  const signal = req.signal;
  if (signal) {
    signal.addEventListener("abort", () => {
      closeHandlers.forEach((handler) => handler());
    });
  }

  return {
    headers: Object.fromEntries(req.headers.entries()),
    url: url.pathname + url.search,
    method: req.method,
    socket: {
      remoteAddress: remoteAddr,
    } as any,
    on: (event: string, handler: () => void) => {
      if (event === "close") {
        closeHandlers.push(handler);
      }
    },
  } as any;
}

/**
 * Streaming adapter for Bun Response that supports res.write() pattern
 * Enables true streaming for SSE (Server-Sent Events) and other streaming responses
 */
class StreamingServerResponse {
  statusCode = 200;
  private _headers: Record<string, string> = {};
  private _headersSent = false;
  private _ended = false;
  private _chunks: (string | Buffer)[] = [];
  private _controller: ReadableStreamController<Uint8Array> | null = null;

  setHeader(name: string, value: string) {
    if (this._headersSent) {
      throw new Error("Cannot set headers after they are sent");
    }
    this._headers[name] = value;
  }

  write(chunk: string | Buffer): boolean {
    if (this._ended) {
      throw new Error("Cannot write after end");
    }

    this._headersSent = true;

    if (this._controller) {
      // Stream already started, push directly
      const encoded =
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
      this._controller.enqueue(encoded);
    } else {
      // Queue for later (will be flushed when toResponse() creates stream)
      this._chunks.push(chunk);
    }

    return true; // Backpressure not implemented (could be added later)
  }

  end(data?: string | Buffer) {
    if (data) {
      this.write(data);
    }
    this._ended = true;

    if (this._controller) {
      this._controller.close();
    }
  }

  flushHeaders() {
    this._headersSent = true;
    // No-op in Bun - headers sent with Response
  }

  get headersSent(): boolean {
    return this._headersSent;
  }

  get ended(): boolean {
    return this._ended;
  }

  toResponse(): Response {
    this._headersSent = true;

    // If already ended with no writes, return simple response
    if (this._ended && this._chunks.length === 0) {
      return new Response(null, {
        status: this.statusCode,
        headers: this._headers,
      });
    }

    // If ended with buffered chunks, return them all
    if (this._ended) {
      const body = this._chunks
        .map((c) => (typeof c === "string" ? c : c.toString("utf-8")))
        .join("");
      return new Response(body, {
        status: this.statusCode,
        headers: this._headers,
      });
    }

    // Still streaming - create ReadableStream
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this._controller = controller;

        // Flush any queued chunks
        for (const chunk of this._chunks) {
          const encoded =
            typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
          controller.enqueue(encoded);
        }
        this._chunks = []; // Clear queue

        // If already ended, close immediately
        if (this._ended) {
          controller.close();
        }
      },
      cancel: () => {
        // Client disconnected
        this._ended = true;
      },
    });

    return new Response(stream, {
      status: this.statusCode,
      headers: this._headers,
    });
  }
}

/**
 * Adapt node:http style handler to Bun Request/Response
 * Supports streaming responses via Readable Stream
 */
async function adaptHttpHandler(
  req: Request,
  handler: HttpRequestHandler,
  remoteAddr?: string,
): Promise<Response | null> {
  const reqStub = createIncomingMessageStub(req, remoteAddr);
  const resStub = new StreamingServerResponse();

  const handled = await handler(reqStub, resStub as any);
  if (!handled) {
    return null;
  }

  // For streaming responses, don't wait for end
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

    fetch(req: Request, server: { requestIP: (req: Request) => { address?: string } | null; upgrade: (req: Request, options: Record<string, unknown>) => boolean }) {
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
