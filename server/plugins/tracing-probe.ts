import { definePlugin } from "nitro";
import { probeState } from "../utils/probe";

const CHANNELS = ["srvx.request", "srvx.middleware", "h3.request"] as const;

export default definePlugin(() => {
  const diagnostics = (globalThis as any).process?.getBuiltinModule?.(
    "node:diagnostics_channel"
  );
  if (!diagnostics?.subscribe) return;

  for (const name of CHANNELS) {
    if (probeState.subscribed.has(name)) continue;
    probeState.subscribed.add(name);

    // Same subscription Nitro's own telemetry sink uses. Listening on the plain
    // channel name works even if the producer creates the channel later.
    diagnostics.subscribe(`tracing:${name}:start`, () => {
      probeState.counts[name] = (probeState.counts[name] ?? 0) + 1;
    });
  }
});
