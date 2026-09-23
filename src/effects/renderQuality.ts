import { useSyncExternalStore } from "react";
import { settingsStore } from "../state/settingsStore";

/**
 * One capability check, made once at load, that the whole render stack reads — and a viewer
 * override on top of it.
 *
 * The expensive realism passes — MSAA, the ambient-occlusion normal pass, big shadow maps — are the
 * difference between "photographic" and "unwatchable" depending on the machine, and this film is
 * meant to run both on a desktop and in a phone held in a headset (see the gyro look and the split
 * view). So the look is authored at the top tier and stepped down, rather than authored at the
 * bottom and never stepped up.
 *
 * Detection is a guess made from a user-agent string and two optional hints, and it is wrong often
 * enough that guessing alone is not good enough: a viewer whose frame rate is suffering has no way
 * to say so. `QualityChoice` is what they say; `QualityTier` is what the renderer does.
 */
export type QualityTier = "high" | "medium" | "low";

/** What the viewer picks. "auto" defers to `detectTier`. */
export type QualityChoice = QualityTier | "auto";

function detectTier(): QualityTier {
  if (typeof navigator === "undefined") return "medium";

  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const cores = navigator.hardwareConcurrency ?? 4;
  // Not in every browser; treated as a hint, never as a requirement.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  if (mobile) return cores >= 8 && memory >= 6 ? "medium" : "low";
  if (cores <= 4 || memory <= 4) return "medium";
  return "high";
}

export interface QualitySettings {
  tier: QualityTier;
  /** MSAA samples inside the effect composer. 0 falls back to the SMAA effect instead. */
  multisampling: number;
  /** Screen-space ambient occlusion. Needs the composer's normal pass, which costs a scene re-render. */
  ambientOcclusion: boolean;
  depthOfField: boolean;
  /** Square resolution of the sun's shadow map. */
  shadowMapSize: number;
  /** Upper bound on device pixel ratio. */
  maxDpr: number;
  /** Repeat multiplier on detail/normal maps; lower tiers tile them less to save texture bandwidth. */
  detailScale: number;
}

const SETTINGS: Record<QualityTier, Omit<QualitySettings, "tier">> = {
  high: { multisampling: 4, ambientOcclusion: true, depthOfField: true, shadowMapSize: 2048, maxDpr: 2, detailScale: 1 },
  medium: { multisampling: 2, ambientOcclusion: false, depthOfField: true, shadowMapSize: 1536, maxDpr: 1.5, detailScale: 0.75 },
  low: { multisampling: 0, ambientOcclusion: false, depthOfField: false, shadowMapSize: 1024, maxDpr: 1.25, detailScale: 0.5 },
};

/** What the machine looks capable of, decided once. */
export const autoTier: QualityTier = detectTier();

/** One frozen object per tier, so `useSyncExternalStore` compares identities rather than spinning. */
const RESOLVED: Record<QualityTier, QualitySettings> = {
  high: { tier: "high", ...SETTINGS.high },
  medium: { tier: "medium", ...SETTINGS.medium },
  low: { tier: "low", ...SETTINGS.low },
};

export function resolveQuality(choice: QualityChoice): QualitySettings {
  return RESOLVED[choice === "auto" ? autoTier : choice];
}

function snapshot(): QualitySettings {
  return resolveQuality(settingsStore.getQuality());
}

/** The active quality, re-rendering the caller when the viewer changes it. */
export function useQuality(): QualitySettings {
  return useSyncExternalStore(settingsStore.subscribe, snapshot, snapshot);
}

/** Non-reactive read, for the render loop and other places that cannot hold a hook. */
export const getQuality = snapshot;

/**
 * The tier as it stood when the page loaded.
 *
 * `detailScale` is baked into every texture's `repeat` at creation, and the materials that hold
 * those textures are memoized across the life of the scene — so unlike the other settings it cannot
 * honestly be changed on the fly. Rather than pretend, the tiling is pinned to the load-time tier
 * and only the settings that really do take effect immediately are wired to the picker.
 */
export const quality: QualitySettings = snapshot();
