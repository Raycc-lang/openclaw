import type { Client } from "@buape/carbon";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTyping } from "./typing.js";

describe("sendTyping", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches the channel and triggers typing when available", async () => {
    const triggerTyping = vi.fn().mockResolvedValue(undefined);
    const fetchChannel = vi.fn().mockResolvedValue({ triggerTyping });
    const client = {
      fetchChannel,
      rest: { queue: [] },
    } as unknown as Client;

    await sendTyping({ client, channelId: "chan-1", timeoutMs: 50 });

    expect(fetchChannel).toHaveBeenCalledWith("chan-1");
    expect(triggerTyping).toHaveBeenCalledTimes(1);
  });

  it("times out without triggering typing after a late fetch", async () => {
    vi.useFakeTimers();
    const triggerTyping = vi.fn().mockResolvedValue(undefined);
    let resolveChannel: ((value: { triggerTyping: typeof triggerTyping }) => void) | undefined;
    const fetchChannel = vi.fn(
      () =>
        new Promise<{ triggerTyping: typeof triggerTyping }>((resolve) => {
          resolveChannel = resolve;
        }),
    );
    const log = vi.fn();
    const client = {
      fetchChannel,
      rest: { queue: [1, 2, 3] },
    } as unknown as Client;

    const pending = sendTyping({ client, channelId: "chan-2", timeoutMs: 25, log });
    const pendingResult = expect(pending).rejects.toThrow(
      "discord typing start timed out after 25ms (channelId=chan-2 queueDepth=3)",
    );
    await vi.advanceTimersByTimeAsync(25);
    await pendingResult;

    expect(log).toHaveBeenCalledWith(
      "discord typing start timed out after 25ms (channelId=chan-2 queueDepth=3)",
    );

    resolveChannel?.({ triggerTyping });
    await Promise.resolve();
    await Promise.resolve();

    expect(triggerTyping).not.toHaveBeenCalled();
  });

  it("does not queue another typing fetch while a timed-out request is still unresolved", async () => {
    vi.useFakeTimers();
    const triggerTyping = vi.fn().mockResolvedValue(undefined);
    let resolveChannel: ((value: { triggerTyping: typeof triggerTyping }) => void) | undefined;
    const fetchChannel = vi.fn(
      () =>
        new Promise<{ triggerTyping: typeof triggerTyping }>((resolve) => {
          resolveChannel = resolve;
        }),
    );
    const client = {
      fetchChannel,
      rest: { queue: [1, 2] },
    } as unknown as Client;

    const first = sendTyping({ client, channelId: "chan-3", timeoutMs: 25 });
    const firstResult = expect(first).rejects.toThrow(
      "discord typing start timed out after 25ms (channelId=chan-3 queueDepth=2)",
    );
    await vi.advanceTimersByTimeAsync(25);
    await firstResult;

    await sendTyping({ client, channelId: "chan-3", timeoutMs: 25 });

    expect(fetchChannel).toHaveBeenCalledTimes(1);

    fetchChannel.mockResolvedValueOnce({ triggerTyping });
    resolveChannel?.({ triggerTyping });
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);

    await sendTyping({ client, channelId: "chan-3", timeoutMs: 25 });
    expect(fetchChannel).toHaveBeenCalledTimes(2);
  });
});
