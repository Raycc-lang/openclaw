/**
 * Bun-specific gateway runtime state creation
 * This is a variant of createGatewayRuntimeState that uses Bun.serve instead of node:http + ws
 */

import type { Server as BunBaseServer, TLSOptions as BunTLSOptions } from "bun";
import type { CliDeps } from "../cli/deps.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginRegistry } from "../plugins/registry.js";
import type { RuntimeEnv } from "../runtime.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import type { ChatAbortControllerEntry } from "./chat-abort.js";
import type { ControlUiRootState } from "./control-ui.js";
import type { HooksConfigResolved } from "./hooks.js";
import type { DedupeEntry } from "./server-shared.js";
import type { GatewayTlsRuntime } from "./server/tls.js";
import type { GatewayWsClient, GatewayWsData } from "./server/ws-types.js";
import { resolveAgentAvatar } from "../agents/identity-avatar.js";
import { CANVAS_HOST_PATH } from "../canvas-host/a2ui.js";
import { type CanvasHostHandler, createCanvasHostHandler } from "../canvas-host/server.js";
import { handleControlUiAvatarRequest, handleControlUiHttpRequest } from "./control-ui.js";
import { createGatewayBroadcaster } from "./server-broadcast.js";
import { createGatewayBunServer } from "./server-bun.js";
import {
  type ChatRunEntry,
  createChatRunState,
  createToolEventRecipientRegistry,
} from "./server-chat.js";
import { createGatewayHooksRequestHandler } from "./server/hooks.js";
import { createGatewayPluginRequestHandler } from "./server/plugins-http.js";

type BunServer = BunBaseServer<GatewayWsData>;

export async function createGatewayRuntimeStateBun(params: {
  cfg: import("../config/config.js").OpenClawConfig;
  bindHost: string;
  port: number;
  controlUiEnabled: boolean;
  controlUiBasePath: string;
  controlUiRoot?: ControlUiRootState;
  openAiChatCompletionsEnabled: boolean;
  openResponsesEnabled: boolean;
  openResponsesConfig?: import("../config/types.gateway.js").GatewayHttpResponsesConfig;
  resolvedAuth: ResolvedGatewayAuth;
  gatewayTls?: GatewayTlsRuntime;
  hooksConfig: () => HooksConfigResolved | null;
  pluginRegistry: PluginRegistry;
  deps: CliDeps;
  canvasRuntime: RuntimeEnv;
  canvasHostEnabled: boolean;
  allowCanvasHostInTests?: boolean;
  logCanvas: { info: (msg: string) => void; warn: (msg: string) => void };
  log: { info: (msg: string) => void; warn: (msg: string) => void };
  logHooks: ReturnType<typeof createSubsystemLogger>;
  logPlugins: ReturnType<typeof createSubsystemLogger>;
  logGateway: ReturnType<typeof createSubsystemLogger>;
  logHealth: ReturnType<typeof createSubsystemLogger>;
  logWsControl: ReturnType<typeof createSubsystemLogger>;
  gatewayMethods: string[];
  events: string[];
  extraHandlersRef: { current: any };
  buildRequestContext: () => import("./server-methods/types.js").GatewayRequestContext;
}): Promise<{
  canvasHost: CanvasHostHandler | null;
  bunServer: BunServer;
  httpBindHost: string;
  clients: Set<GatewayWsClient>;
  broadcast: (
    event: string,
    payload: unknown,
    opts?: {
      dropIfSlow?: boolean;
      stateVersion?: { presence?: number; health?: number };
    },
  ) => void;
  broadcastToConnIds: (
    event: string,
    payload: unknown,
    connIds: ReadonlySet<string>,
    opts?: {
      dropIfSlow?: boolean;
      stateVersion?: { presence?: number; health?: number };
    },
  ) => void;
  agentRunSeq: Map<string, number>;
  dedupe: Map<string, DedupeEntry>;
  chatRunState: ReturnType<typeof createChatRunState>;
  chatRunBuffers: Map<string, string>;
  chatDeltaSentAt: Map<string, number>;
  addChatRun: (sessionId: string, entry: ChatRunEntry) => void;
  removeChatRun: (
    sessionId: string,
    clientRunId: string,
    sessionKey?: string,
  ) => ChatRunEntry | undefined;
  chatAbortControllers: Map<string, ChatAbortControllerEntry>;
  toolEventRecipients: ReturnType<typeof createToolEventRecipientRegistry>;
}> {
  // Create canvas host handler (same as original)
  let canvasHost: CanvasHostHandler | null = null;
  if (params.canvasHostEnabled) {
    try {
      const handler = await createCanvasHostHandler({
        runtime: params.canvasRuntime,
        rootDir: params.cfg.canvasHost?.root,
        basePath: CANVAS_HOST_PATH,
        allowInTests: params.allowCanvasHostInTests,
        liveReload: params.cfg.canvasHost?.liveReload,
      });
      if (handler.rootDir) {
        canvasHost = handler;
        params.logCanvas.info(
          `canvas host mounted at http://${params.bindHost}:${params.port}${CANVAS_HOST_PATH}/ (root ${handler.rootDir})`,
        );
      }
    } catch (err) {
      params.logCanvas.warn(`canvas host failed to start: ${String(err)}`);
    }
  }

  // Create state objects (same as original)
  const clients = new Set<GatewayWsClient>();
  const { broadcast, broadcastToConnIds } = createGatewayBroadcaster({ clients });

  const handleHooksRequest = createGatewayHooksRequestHandler({
    deps: params.deps,
    getHooksConfig: params.hooksConfig,
    bindHost: params.bindHost,
    port: params.port,
    logHooks: params.logHooks,
  });

  const handlePluginRequest = createGatewayPluginRequestHandler({
    registry: params.pluginRegistry,
    log: params.logPlugins,
  });

  const agentRunSeq = new Map<string, number>();
  const dedupe = new Map<string, DedupeEntry>();
  const chatRunState = createChatRunState();
  const chatRunRegistry = chatRunState.registry;
  const chatRunBuffers = chatRunState.buffers;
  const chatDeltaSentAt = chatRunState.deltaSentAt;
  const addChatRun = chatRunRegistry.add;
  const removeChatRun = chatRunRegistry.remove;
  const chatAbortControllers = new Map<string, ChatAbortControllerEntry>();
  const toolEventRecipients = createToolEventRecipientRegistry();

  const handleControlUiRequest = async (
    req: Parameters<typeof handleHooksRequest>[0],
    res: Parameters<typeof handleHooksRequest>[1],
  ) => {
    if (!params.controlUiEnabled) {
      return false;
    }
    const configSnapshot = params.cfg;
    if (
      handleControlUiAvatarRequest(req, res, {
        basePath: params.controlUiBasePath,
        resolveAvatar: (agentId) => resolveAgentAvatar(configSnapshot, agentId),
      })
    ) {
      return true;
    }
    if (
      handleControlUiHttpRequest(req, res, {
        basePath: params.controlUiBasePath,
        config: configSnapshot,
        root: params.controlUiRoot,
      })
    ) {
      return true;
    }
    return false;
  };

  // Create Bun server (NEW: replaces HTTP + WebSocket server creation)
  const bunServer = createGatewayBunServer({
    bindHost: params.bindHost,
    port: params.port,
    clients,
    resolvedAuth: params.resolvedAuth,
    tlsOptions: params.gatewayTls?.enabled
      ? (params.gatewayTls.tlsOptions as unknown as BunTLSOptions)
      : undefined,
    gatewayHost:
      params.bindHost !== "0.0.0.0" && params.bindHost !== "::" ? params.bindHost : undefined,
    canvasHostEnabled: params.canvasHostEnabled,
    canvasHostServerPort: undefined, // TODO: Support separate canvas host port
    gatewayMethods: params.gatewayMethods,
    events: params.events,
    logGateway: params.logGateway,
    logHealth: params.logHealth,
    logWsControl: params.logWsControl,
    extraHandlersRef: params.extraHandlersRef,
    broadcast,
    buildRequestContext: params.buildRequestContext,
    httpHandlers: [handleControlUiRequest, handleHooksRequest, handlePluginRequest],
  });

  params.log.info(`gateway listening on http://${params.bindHost}:${params.port}`);

  return {
    canvasHost,
    bunServer,
    httpBindHost: params.bindHost,
    clients,
    broadcast,
    broadcastToConnIds,
    agentRunSeq,
    dedupe,
    chatRunState,
    chatRunBuffers,
    chatDeltaSentAt,
    addChatRun,
    removeChatRun,
    chatAbortControllers,
    toolEventRecipients,
  };
}
