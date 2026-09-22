/**
 * One capability check, made once at load, that the whole render stack reads.
 *
 * The expensive realism passes — MSAA, the ambient-occlusion normal pass, big shadow maps — are the
 * difference between "photographic" and "unwatchable" depending on the machine, and this film is
 * meant to run both on a desktop and in a phone held in a headset (see the gyro look and the split
 * view). So the look is authored at the top tier and stepped down, rather than authored at the
 * bottom and never stepped up.
 */
export type QualityTier = "high" | "medium" | "low";

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
  /** Cube resolution of the reflection probe — what glass, paint and polished rail actually mirror. */
  envResolution: number;
  /** Upper bound on device pixel ratio. */
  maxDpr: number;
  /** Repeat multiplier on detail/normal maps; lower tiers tile them less to save texture bandwidth. */
  detailScale: number;
}

const SETTINGS: Record<QualityTier, Omit<QualitySettings, "tier">> = {
  high: { multisampling: 4, ambientOcclusion: true, depthOfField: true, shadowMapSize: 2048, envResolution: 256, maxDpr: 2, detailScale: 1 },
  medium: { multisampling: 2, ambientOcclusion: false, depthOfField: true, shadowMapSize: 1536, envResolution: 128, maxDpr: 1.5, detailScale: 0.75 },
  low: { multisampling: 0, ambientOcclusion: false, depthOfField: false, shadowMapSize: 1024, envResolution: 64, maxDpr: 1.25, detailScale: 0.5 },
};

const tier = detectTier();

export const quality: QualitySettings = { tier, ...SETTINGS[tier] };
