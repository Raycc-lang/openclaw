import type { SandboxBrowserContext, SandboxConfig } from "./types.js";

// Browser functionality removed - stubbed out for compilation
export async function ensureSandboxBrowser(params: {
  scopeKey: string;
  workspaceDir: string;
  agentWorkspaceDir: string;
  cfg: SandboxConfig;
  evaluateEnabled?: boolean;
}): Promise<SandboxBrowserContext | null> {
  // Browser disabled in miniAgent
  return null;
}
