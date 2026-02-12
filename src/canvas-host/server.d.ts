/**
 * Type declarations for canvas-host/server.js (stub from Phase 1)
 */

export interface CanvasHostHandler {
  close: () => Promise<void>;
  rootDir?: string;
}

export interface CanvasHostServer {
  close: () => Promise<void>;
}

export function createCanvasHostHandler(params: {
  runtime: any;
  rootDir?: string;
  basePath: string;
  allowInTests?: boolean;
  liveReload?: boolean;
}): Promise<CanvasHostHandler>;
