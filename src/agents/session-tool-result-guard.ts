import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { emitSessionTranscriptUpdate } from "../sessions/transcript-events.js";
import { makeMissingToolResult, makeToolTimeoutResult, sanitizeToolCallInputs } from "./session-transcript-repair.js";

type ToolCall = { id: string; name?: string };

type PendingToolCall = {
  name: string | undefined;
  deadlineAt: number;
};

function extractAssistantToolCalls(msg: Extract<AgentMessage, { role: "assistant" }>): ToolCall[] {
  const content = msg.content;
  if (!Array.isArray(content)) {
    return [];
  }
  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const rec = block as { type?: unknown; id?: unknown; name?: unknown };
    if (typeof rec.id !== "string" || !rec.id) {
      continue;
    }
    if (rec.type === "toolCall" || rec.type === "toolUse" || rec.type === "functionCall") {
      toolCalls.push({
        id: rec.id,
        name: typeof rec.name === "string" ? rec.name : undefined,
      });
    }
  }
  return toolCalls;
}

function extractToolResultId(msg: Extract<AgentMessage, { role: "toolResult" }>): string | null {
  const toolCallId = (msg as { toolCallId?: unknown }).toolCallId;
  if (typeof toolCallId === "string" && toolCallId) {
    return toolCallId;
  }
  const toolUseId = (msg as { toolUseId?: unknown }).toolUseId;
  if (typeof toolUseId === "string" && toolUseId) {
    return toolUseId;
  }
  return null;
}

export function installSessionToolResultGuard(
  sessionManager: SessionManager,
  opts?: {
    /**
     * Optional, synchronous transform applied to toolResult messages *before* they are
     * persisted to the session transcript.
     */
    transformToolResultForPersistence?: (
      message: AgentMessage,
      meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
    ) => AgentMessage;
    /**
     * Whether to synthesize missing tool results to satisfy strict providers.
     * Defaults to true.
     */
    allowSyntheticToolResults?: boolean;
    /**
     * Timeout in milliseconds for pending tool calls before a synthetic timeout error
     * result is injected. Defaults to 60000 (60 seconds).
     */
    toolCallTimeoutMs?: number;
    /**
     * Interval in milliseconds for checking pending tool call timeouts.
     * Defaults to 5000 (5 seconds).
     */
    timeoutCheckIntervalMs?: number;
  },
): { flushPendingToolResults: () => void; getPendingIds: () => string[]; stopTimeoutChecker: () => void } {
  const originalAppend = sessionManager.appendMessage.bind(sessionManager);
  const pending = new Map<string, PendingToolCall>();
  
  const toolCallTimeoutMs = opts?.toolCallTimeoutMs ?? 60000;
  const timeoutCheckIntervalMs = opts?.timeoutCheckIntervalMs ?? 5000;

  const persistToolResult = (
    message: AgentMessage,
    meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
  ) => {
    const transformer = opts?.transformToolResultForPersistence;
    return transformer ? transformer(message, meta) : message;
  };

  const allowSyntheticToolResults = opts?.allowSyntheticToolResults ?? true;

  const flushPendingToolResults = () => {
    if (pending.size === 0) {
      return;
    }
    if (allowSyntheticToolResults) {
      for (const [id, info] of pending.entries()) {
        const synthetic = makeMissingToolResult({ toolCallId: id, toolName: info.name });
        originalAppend(
          persistToolResult(synthetic, {
            toolCallId: id,
            toolName: info.name,
            isSynthetic: true,
          }) as never,
        );
      }
    }
    pending.clear();
  };

  const checkTimeouts = () => {
    const now = Date.now();
    const timedOut: Array<{ id: string; info: PendingToolCall }> = [];
    
    for (const [id, info] of pending.entries()) {
      if (now >= info.deadlineAt) {
        timedOut.push({ id, info });
      }
    }
    
    for (const { id, info } of timedOut) {
      pending.delete(id);
      if (allowSyntheticToolResults) {
        const synthetic = makeToolTimeoutResult({
          toolCallId: id,
          toolName: info.name,
          timeoutMs: toolCallTimeoutMs,
        });
        originalAppend(
          persistToolResult(synthetic, {
            toolCallId: id,
            toolName: info.name,
            isSynthetic: true,
          }) as never,
        );
      }
    }
    
    if (pending.size > 0) {
      timeoutTimer = setTimeout(checkTimeouts, timeoutCheckIntervalMs);
    }
  };

  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const startTimeoutChecker = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
    if (pending.size > 0) {
      timeoutTimer = setTimeout(checkTimeouts, timeoutCheckIntervalMs);
    }
  };

  const stopTimeoutChecker = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  const guardedAppend = (message: AgentMessage) => {
    let nextMessage = message;
    const role = (message as { role?: unknown }).role;
    if (role === "assistant") {
      const sanitized = sanitizeToolCallInputs([message]);
      if (sanitized.length === 0) {
        if (allowSyntheticToolResults && pending.size > 0) {
          flushPendingToolResults();
        }
        return undefined;
      }
      nextMessage = sanitized[0];
    }
    const nextRole = (nextMessage as { role?: unknown }).role;
    if (nextRole === "toolResult") {
      const id = extractToolResultId(nextMessage as Extract<AgentMessage, { role: "toolResult" }>);
      const pendingInfo = id ? pending.get(id) : undefined;
      if (id) {
        pending.delete(id);
        if (pending.size === 0) {
          stopTimeoutChecker();
        }
      }
      return originalAppend(
        persistToolResult(nextMessage, {
          toolCallId: id ?? undefined,
          toolName: pendingInfo?.name,
          isSynthetic: false,
        }) as never,
      );
    }
    const toolCalls =
      nextRole === "assistant"
        ? extractAssistantToolCalls(nextMessage as Extract<AgentMessage, { role: "assistant" }>)
        : [];
    if (allowSyntheticToolResults) {
      // If previous tool calls are still pending, flush before non-tool results.
      if (pending.size > 0 && (toolCalls.length === 0 || nextRole !== "assistant")) {
        flushPendingToolResults();
        stopTimeoutChecker();
      }
      // If new tool calls arrive while older ones are pending, flush the old ones first.
      if (pending.size > 0 && toolCalls.length > 0) {
        flushPendingToolResults();
        stopTimeoutChecker();
      }
    }
    const result = originalAppend(nextMessage as never);
    const sessionFile = (
      sessionManager as { getSessionFile?: () => string | null }
    ).getSessionFile?.();
    if (sessionFile) {
      emitSessionTranscriptUpdate(sessionFile);
    }
    if (toolCalls.length > 0) {
      const deadlineAt = Date.now() + toolCallTimeoutMs;
      for (const call of toolCalls) {
        pending.set(call.id, { name: call.name, deadlineAt });
      }
      startTimeoutChecker();
    }
    return result;
  };

  // Monkey-patch appendMessage with our guarded version.
  sessionManager.appendMessage = guardedAppend as SessionManager["appendMessage"];
  
  return {
    flushPendingToolResults,
    getPendingIds: () => Array.from(pending.keys()),
    stopTimeoutChecker,
  };
}
