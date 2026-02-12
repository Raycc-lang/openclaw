import type { OutboundSendDeps } from "../infra/outbound/deliver.js";

export type CliDeps = {
  sendMessageDiscord: NonNullable<OutboundSendDeps["sendDiscord"]>;
};

// Provider docking: extend this mapping when adding new outbound send deps.
export function createOutboundSendDeps(deps: CliDeps): OutboundSendDeps {
  return {
    sendDiscord: deps.sendMessageDiscord,
  };
}
