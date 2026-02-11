export type GatewayDaemonRuntime = "node" | "bun";

export const DEFAULT_GATEWAY_DAEMON_RUNTIME: GatewayDaemonRuntime = "node";

export const GATEWAY_DAEMON_RUNTIME_OPTIONS: Array<{
  value: GatewayDaemonRuntime;
  label: string;
  hint?: string;
}> = [
  {
    value: "node",
    label: "Node",
    hint: "Standard Node.js runtime",
  },
  {
    value: "bun",
    label: "Bun",
    hint: "Fast JavaScript runtime (fork customization)",
  },
];

export function isGatewayDaemonRuntime(value: string | undefined): value is GatewayDaemonRuntime {
  return value === "node" || value === "bun";
}
