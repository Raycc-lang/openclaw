import { resolveAgentMaxConcurrent, resolveSubagentMaxConcurrent } from "../config/agent-limits.js";
import type { loadConfig } from "../config/config.js";
import { setCommandLaneConcurrency } from "../process/command-queue.js";
import { CommandLane } from "../process/lanes.js";

export function applyGatewayLaneConcurrency(cfg: ReturnType<typeof loadConfig>) {
  const agentConcurrency = resolveAgentMaxConcurrent(cfg);
  setCommandLaneConcurrency(CommandLane.Cron, cfg.cron?.maxConcurrentRuns ?? 1);
  setCommandLaneConcurrency(CommandLane.Main, agentConcurrency);
  setCommandLaneConcurrency(CommandLane.DiscordInbound, agentConcurrency);
  setCommandLaneConcurrency(CommandLane.Subagent, resolveSubagentMaxConcurrent(cfg));
}
