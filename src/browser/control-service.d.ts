/**
 * Type declarations for browser/control-service.js (stub from Phase 1)
 */

export function createBrowserControlContext(params: any): any;

export function startBrowserControlServiceFromConfig(params: {
  cfg: any;
  bindHost: string;
  port: number;
}): Promise<{ stop: () => Promise<void> } | null>;
