export type EraId = "steam" | "diesel" | "electric" | "modern" | "final";

export interface Era {
  id: EraId;
  title: string;
  subtitle?: string;
  /** seconds, inclusive */
  start: number;
  /** seconds, exclusive (except for the last era) */
  end: number;
  /** rough forward travel speed used for wheel spin / motion effects */
  trainSpeed: number;
}

/** Local duration (seconds) of the Evolution scene. In the 5-minute cut this is the heart of the
 * film: three of the seven stages of the railway's evolution — diesel, electrification, high-speed —
 * each get exactly 40 seconds of it, counting the handoff that introduces the generation plus the
 * ride on it. */
export const EVOLUTION_DURATION = 120;

/** Crossfade window (seconds) used at era boundaries for train + title transitions. Kept short so
 * the outgoing/incoming train's semi-transparent "dissolve" state is brief rather than a lingering
 * see-through ghost. */
export const ERA_TRANSITION_SECONDS = 0.45;

// Each window runs from the moment that generation starts arriving to the moment the next one does,
// so a "stage" is the 25-second handoff plus the ride that follows it:
//   diesel      20 -> 65   (ride 20-40, then the diesel is swapped for the electric)
//   electric    65 -> 105  (ride 65-80, then the electric is swapped for the modern unit)
//   high-speed 105 -> 120  (the closing run)
// The handoffs themselves are carved off the end of each window by `EvolutionScene`.
export const ERAS: Era[] = [
  { id: "steam", title: "STEAM ERA", start: 0, end: 20, trainSpeed: 0.6 },
  { id: "diesel", title: "DIESEL ERA", start: 20, end: 65, trainSpeed: 1.5 },
  { id: "electric", title: "ELECTRIFICATION", start: 65, end: 105, trainSpeed: 2.6 },
  { id: "modern", title: "HIGH-SPEED RAIL", start: 105, end: 114, trainSpeed: 4 },
  {
    id: "final",
    title: "TRAIN EVOLUTION",
    subtitle: "From Steam to Speed",
    start: 114,
    end: 120,
    trainSpeed: 4.5,
  },
];

export function getEraAtTime(t: number): Era {
  const clamped = Math.min(Math.max(t, 0), EVOLUTION_DURATION);
  for (const era of ERAS) {
    if (clamped >= era.start && clamped < era.end) return era;
  }
  return ERAS[ERAS.length - 1];
}

export function getEraIndexAtTime(t: number): number {
  const era = getEraAtTime(t);
  return ERAS.indexOf(era);
}

/** 0..1 progress within the given era */
export function getEraProgress(t: number, era: Era): number {
  const span = era.end - era.start;
  if (span <= 0) return 1;
  return Math.min(Math.max((t - era.start) / span, 0), 1);
}

/** 0..1 progress across the whole "evolution" (steam -> end of modern), used to
 * continuously blend environment lighting/materials rather than hard-cutting them. */
export function getGlobalProgress(t: number): number {
  const modernEnd = ERAS[3].end;
  return Math.min(Math.max(t / modernEnd, 0), 1);
}

/** Shared along-track path used by both the active train and the camera, so they stay in sync. */
export const PATH_START_Z = 14;
export const PATH_END_Z = -14;
export const FINAL_PATH_END_Z = -30;

/** Ken Perlin's smootherstep: eases in and out, used to fake a train accelerating away and braking to a stop.
 * Shared by the train rig and the camera so both track the exact same eased position. */
export function smootherstep(x: number): number {
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** World-space Z of whichever train is currently "active" (steam/diesel/electric, or modern+final combined). */
export function getActiveTrainZ(t: number): number {
  const era = getEraAtTime(t);
  if (era.id === "modern" || era.id === "final") {
    // Modern/final share one continuous high-speed run, so it stays at constant velocity (no ease).
    const modernEra = ERAS[3];
    const finalEra = ERAS[4];
    const p = Math.min(Math.max((t - modernEra.start) / (finalEra.end - modernEra.start), 0), 1);
    return THREE_LERP(PATH_START_Z, FINAL_PATH_END_Z, p);
  }
  const p = smootherstep(getEraProgress(t, era));
  return THREE_LERP(PATH_START_Z, PATH_END_Z, p);
}

function THREE_LERP(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
