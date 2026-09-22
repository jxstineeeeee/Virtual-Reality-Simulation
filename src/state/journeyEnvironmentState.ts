/**
 * Shared mutable state (updated every frame from `JourneyScene`, read every frame by
 * `GlobalAtmosphere`) describing what's passing outside the window right now — so cabin lighting can
 * react to it (tree-shadow flicker, tunnel dark-out) without wiring a React prop chain between two
 * otherwise-independent components, matching the ref-based, no-re-render pattern used throughout.
 */
class JourneyEnvironmentState {
  /** Distance traveled along the journey track — drives the tree-shadow flicker rate. */
  distance = 0;
  /** True while `TreeField`/similar foliage is passing close enough to flicker the sun. */
  hasFoliage = false;
  /** 0 = full daylight, 1 = fully inside the tunnel. */
  tunnelFactor = 0;
  /** Only meaningful while the journey scene is actually mounted. */
  active = false;
}

export const journeyEnvironmentState = new JourneyEnvironmentState();

// Late in the mountain stretch, but inside the 27 design-seconds of this scene the 5-minute cut
// actually plays — at the far end of the old timings the tunnel simply never arrived.
const TUNNEL_START = 21;
const TUNNEL_FADE_IN_END = 21.8;
const TUNNEL_FADE_OUT_START = 24.5;
const TUNNEL_END = 25.3;

/** 0..1 tunnel darkness for a given local journey-scene time — a short passage late in the mountain
 * stretch, per the brief's "sunlight -> tree shadow -> tunnel -> tunnel lights -> exit" beat. */
export function getTunnelFactor(local: number): number {
  if (local < TUNNEL_START || local > TUNNEL_END) return 0;
  if (local < TUNNEL_FADE_IN_END) return (local - TUNNEL_START) / (TUNNEL_FADE_IN_END - TUNNEL_START);
  if (local > TUNNEL_FADE_OUT_START) return 1 - (local - TUNNEL_FADE_OUT_START) / (TUNNEL_END - TUNNEL_FADE_OUT_START);
  return 1;
}
