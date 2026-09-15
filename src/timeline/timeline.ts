export type SceneId =
  | "preview"
  | "boarding"
  | "interior"
  | "departure"
  | "journey"
  | "exteriorRide"
  | "evolution"
  | "modernRide"
  | "arrival";

export interface SceneDef {
  id: SceneId;
  title: string;
  /** seconds, inclusive */
  start: number;
  /** seconds, exclusive (except for the last scene) */
  end: number;
  /** Opens with a hard cut (camera + location change) rather than continuing the previous shot. */
  hardCut: boolean;
}

/** Full cinematic runtime: ~8 minutes. */
export const TOTAL_DURATION = 480;

// Rebalanced so the steam-era loop (preview..exteriorRide) no longer eats most of the runtime: it now
// takes ~3:45 of the 8 minutes, leaving ~4:15 for diesel/electric/modern to each get a real ride
// instead of a brief crossfade. Each steam scene's internal keyframe timings are scaled to match.
export const SCENES: SceneDef[] = [
  { id: "preview", title: "THE TRAIN", start: 0, end: 30, hardCut: false },
  { id: "boarding", title: "BOARDING", start: 30, end: 65, hardCut: true },
  { id: "interior", title: "ONBOARD", start: 65, end: 95, hardCut: true },
  { id: "departure", title: "DEPARTURE", start: 95, end: 125, hardCut: false },
  { id: "journey", title: "THE JOURNEY", start: 125, end: 180, hardCut: true },
  { id: "exteriorRide", title: "FIRST ARRIVAL", start: 180, end: 225, hardCut: true },
  { id: "evolution", title: "TRAIN EVOLUTION", start: 225, end: 395, hardCut: true },
  { id: "modernRide", title: "THE NEW GENERATION", start: 395, end: 450, hardCut: true },
  { id: "arrival", title: "ARRIVAL", start: 450, end: 480, hardCut: false },
];

export function getSceneAt(t: number): SceneDef {
  const clamped = Math.min(Math.max(t, 0), TOTAL_DURATION);
  for (const s of SCENES) if (clamped >= s.start && clamped < s.end) return s;
  return SCENES[SCENES.length - 1];
}

export interface SceneLocal {
  scene: SceneDef;
  /** seconds elapsed within the scene, clamped to its span */
  local: number;
  /** 0..1 progress through the scene */
  progress: number;
  index: number;
}

export function getSceneLocal(t: number): SceneLocal {
  const scene = getSceneAt(t);
  const index = SCENES.indexOf(scene);
  const span = Math.max(scene.end - scene.start, 0.0001);
  const local = Math.min(Math.max(t - scene.start, 0), span);
  return { scene, local, progress: local / span, index };
}

/** Ken Perlin's smootherstep: eases in and out. */
export function smootherstep(x: number): number {
  const c = clamp01(x);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

export function clamp01(x: number): number {
  return Math.min(Math.max(x, 0), 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Ramps 0->1 over `duration` seconds starting at `start`, then holds at 1. */
export function fadeIn(t: number, start: number, duration = 1): number {
  return clamp01((t - start) / duration);
}

/** Fades in, holds, then fades out within [start, end]. */
export function fadeWindow(t: number, start: number, end: number, fade = 0.6): number {
  if (t < start || t > end) return 0;
  if (t < start + fade) return (t - start) / fade;
  if (t > end - fade) return (end - t) / fade;
  return 1;
}
