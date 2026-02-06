import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { installSessionToolResultGuard } from "./session-tool-result-guard.js";

export type GuardedSessionManager = SessionManager & {
  /** Flush any synthetic tool results for pending tool calls. Idempotent. */
  flushPendingToolResults?: () => void;
  /** Stop the timeout checker. Used for cleanup. */
  stopTimeoutChecker?: () => void;
};

const guardMetadata = new WeakMap<
  SessionManager,
  {
    toolCallTimeoutMs?: number;
    timeoutCheckIntervalMs?: number;
    allowSyntheticToolResults?: boolean;
  }
>();

/**
 * Apply the tool-result guard to a SessionManager exactly once and expose
 * a flush method on the instance for easy teardown handling.
 */
export function guardSessionManager(
  sessionManager: SessionManager,
  opts?: {
    agentId?: string;
    sessionKey?: string;
    allowSyntheticToolResults?: boolean;
    toolCallTimeoutMs?: number;
    timeoutCheckIntervalMs?: number;
  },
): GuardedSessionManager {
  const existing = guardMetadata.get(sessionManager);
  if (existing) {
    // Guard already installed - check for option changes
    if (
      opts?.toolCallTimeoutMs !== undefined &&
      opts.toolCallTimeoutMs !== existing.toolCallTimeoutMs
    ) {
      console.warn(
        "guardSessionManager: toolCallTimeoutMs changed but guard was already installed. " +
          "New timeout will not take effect. Consider creating a new session manager.",
      );
    }
    if (
      opts?.timeoutCheckIntervalMs !== undefined &&
      opts.timeoutCheckIntervalMs !== existing.timeoutCheckIntervalMs
    ) {
      console.warn(
        "guardSessionManager: timeoutCheckIntervalMs changed but guard was already installed. " +
          "New interval will not take effect. Consider creating a new session manager.",
      );
    }
    return sessionManager as GuardedSessionManager;
  }

  const hookRunner = getGlobalHookRunner();
  const transform = hookRunner?.hasHooks("tool_result_persist")
    ? (message: unknown, meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean }) => {
        const out = hookRunner.runToolResultPersist(
          {
            toolName: meta.toolName,
            toolCallId: meta.toolCallId,
            message,
            isSynthetic: meta.isSynthetic,
          },
          {
            agentId: opts?.agentId,
            sessionKey: opts?.sessionKey,
            toolName: meta.toolName,
            toolCallId: meta.toolCallId,
          },
        );
        return out?.message ?? message;
      }
    : undefined;

  const guard = installSessionToolResultGuard(sessionManager, {
    transformToolResultForPersistence: transform,
    allowSyntheticToolResults: opts?.allowSyntheticToolResults,
    toolCallTimeoutMs: opts?.toolCallTimeoutMs,
    timeoutCheckIntervalMs: opts?.timeoutCheckIntervalMs,
  });

  (sessionManager as GuardedSessionManager).flushPendingToolResults = guard.flushPendingToolResults;
  (sessionManager as GuardedSessionManager).stopTimeoutChecker = guard.stopTimeoutChecker;

  guardMetadata.set(sessionManager, {
    toolCallTimeoutMs: opts?.toolCallTimeoutMs,
    timeoutCheckIntervalMs: opts?.timeoutCheckIntervalMs,
    allowSyntheticToolResults: opts?.allowSyntheticToolResults,
  });

  return sessionManager as GuardedSessionManager;
}
