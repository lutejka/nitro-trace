export interface ProbeState {
  counts: Record<string, number>;
  subscribed: Set<string>;
}

const globalState = globalThis as typeof globalThis & {
  __nitroTraceProbe?: ProbeState;
};

export const probeState: ProbeState = (globalState.__nitroTraceProbe ??= {
  counts: {},
  subscribed: new Set(),
});

export function getProbeCounts(): Record<string, number> {
  return { ...probeState.counts };
}
