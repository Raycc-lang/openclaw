import type { OutboundSendDeps } from "../infra/outbound/deliver.js";
import { sendMessageDiscord } from "../discord/send.js";

export type CliDeps = {
  sendMessageDiscord: typeof sendMessageDiscord;
};

export function createDefaultDeps(): CliDeps {
  return {
    sendMessageDiscord,
  };
}

// Provider docking: extend this mapping when adding new outbound send deps.
export function createOutboundSendDeps(deps: CliDeps): OutboundSendDeps {
  return {
    sendDiscord: deps.sendMessageDiscord,
  };
}
