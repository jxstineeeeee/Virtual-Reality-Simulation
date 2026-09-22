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
  /**
   * How many seconds of the scene's *own* choreography play inside this window. Each scene keeps its
   * keyframes, door timings and cue constants in its original design seconds; this is what maps them
   * onto the shorter runtime, so nothing inside a scene had to be re-tuned by hand:
   *   scale = designSpan / (end - start)  — above 1 the scene simply plays tighter
   * and any choreography past `designSpan` is never reached, which is how the long rides are trimmed
   * rather than sped up to a blur.
   */
  designSpan: number;
}

/** Full cinematic runtime: 5 minutes. */
export const TOTAL_DURATION = 300;

// The 5-minute cut, built around the seven stages of the railway's evolution: early railways (the
// prologue on the platform), steam, diesel, electrification, high-speed, smart rail, and what comes
// next. The three middle generations each get 40 seconds of the Evolution scene (ride + handoff),
// and the steam block keeps the longest run because it is the only stage with a whole story — board,
// ride, arrive — built for it. `designSpan` per scene does the compressing; see `SceneDef`.
export const SCENES: SceneDef[] = [
  { id: "preview", title: "EARLY RAILWAYS", start: 0, end: 18, hardCut: false, designSpan: 27 },
  { id: "boarding", title: "THE STEAM ERA", start: 18, end: 42, hardCut: true, designSpan: 35 },
  { id: "interior", title: "ONBOARD", start: 42, end: 54, hardCut: true, designSpan: 18 },
  { id: "departure", title: "DEPARTURE", start: 54, end: 74, hardCut: false, designSpan: 30 },
  { id: "journey", title: "THE JOURNEY", start: 74, end: 92, hardCut: true, designSpan: 27 },
  { id: "exteriorRide", title: "THE END OF STEAM", start: 92, end: 118, hardCut: true, designSpan: 41 },
  { id: "evolution", title: "TRAIN EVOLUTION", start: 118, end: 238, hardCut: true, designSpan: 120 },
  { id: "modernRide", title: "SMART RAIL", start: 238, end: 278, hardCut: true, designSpan: 56 },
  { id: "arrival", title: "THE FUTURE", start: 278, end: 300, hardCut: false, designSpan: 31 },
];

/** How much faster than its design timings a scene plays inside its (shorter) window. */
export function sceneTimeScale(scene: SceneDef): number {
  return scene.designSpan / Math.max(scene.end - scene.start, 0.0001);
}

export function getScene(id: SceneId): SceneDef {
  return SCENES.find((s) => s.id === id)!;
}

/**
 * Absolute clock time at which a scene reaches `local` of its own design seconds. Anything outside a
 * scene that has to line up with a moment *inside* it — a cut flash, an overlay — has to go through
 * this rather than adding the local time to the scene's start, which stopped being the same thing
 * once scenes began playing tighter than they were authored (see `SceneDef.designSpan`).
 */
export function sceneTimeAt(id: SceneId, local: number): number {
  const scene = getScene(id);
  return scene.start + local / sceneTimeScale(scene);
}

/** A scene's own design-seconds clock for an absolute time, without going through `getSceneAt`. */
export function sceneLocalAt(id: SceneId, elapsed: number): number {
  const scene = getScene(id);
  return (elapsed - scene.start) * sceneTimeScale(scene);
}

export function getSceneAt(t: number): SceneDef {
  const clamped = Math.min(Math.max(t, 0), TOTAL_DURATION);
  for (const s of SCENES) if (clamped >= s.start && clamped < s.end) return s;
  return SCENES[SCENES.length - 1];
}

export interface SceneLocal {
  scene: SceneDef;
  /** Scene-local time in the scene's own design seconds (see `SceneDef.designSpan`), clamped to it. */
  local: number;
  /** 0..1 progress through the scene */
  progress: number;
  index: number;
}

export function getSceneLocal(t: number): SceneLocal {
  const scene = getSceneAt(t);
  const index = SCENES.indexOf(scene);
  // Scene-local time is in the scene's own design seconds, not wall-clock seconds into the window,
  // so every keyframe, door timing and audio cue inside a scene still means what it always did.
  const local = Math.min(Math.max(t - scene.start, 0) * sceneTimeScale(scene), scene.designSpan);
  return { scene, local, progress: local / scene.designSpan, index };
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
