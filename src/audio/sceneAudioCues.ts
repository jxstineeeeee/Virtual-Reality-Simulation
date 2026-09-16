import type { SceneId } from "../timeline/timeline";
import { DOOR_CLOSE_END as DEP_DOOR_CLOSE, ACCEL_START as DEP_ACCEL, JERK_ANCHOR as DEP_JERK } from "../scenes/DepartureScene";
import { TRAIN_DOOR_CLOSE as FIRST_TRAIN_DOOR_CLOSE, FIRST_ARRIVAL_EXIT_CUT } from "../scenes/ExteriorRideScene";
import { ARRIVAL_EXIT_CUT } from "../scenes/ArrivalScene";
import { EVOLUTION_AUDIO_BEATS } from "../scenes/EvolutionScene";
import type { AudioEra } from "./TrainAudioEngine";

export type CueKind =
  /** The train's own warning — whistle, air horn or two-tone, depending on the era. */
  | "horn"
  /** The station PA's three-note chime. */
  | "chime"
  /** The guard's pea whistle: right of way. */
  | "conductor"
  /** Slack running out through the couplers. */
  | "coupler"
  /** A carriage door pulled shut. */
  | "doorThunk";

export interface AudioCue {
  /** Scene-local seconds. */
  t: number;
  kind: CueKind;
  /** Era of the train being heard, when it isn't the one the scene is otherwise running in — a
   * departing generation still sounds like itself while the next one waits to roll in. */
  era?: AudioEra;
}

/**
 * Discrete sound events hung on each scene's own timing constants. This is audio *direction* — the
 * moments a driver would reach for the whistle — as opposed to the continuous engine/wheel/brake
 * layer, which `AudioDriver` derives from each scene's real motion functions instead.
 */
const CUES: Partial<Record<SceneId, AudioCue[]>> = {
  // Scene 1 — waiting on the platform beside a steam loco in steam.
  preview: [
    { t: 6, kind: "chime" },
    { t: 21, kind: "horn" },
  ],
  // Scene 2 — walking the platform to the carriage door.
  boarding: [
    { t: 4, kind: "chime" },
    { t: 30, kind: "conductor" },
  ],
  // Scene 3 — sat inside while the station carries on outside the glass.
  interior: [{ t: 11, kind: "chime" }],
  // Scene 4 — doors shut, the guard waves it off, couplers snatch, and it whistles away.
  departure: [
    { t: DEP_DOOR_CLOSE, kind: "doorThunk" },
    { t: DEP_DOOR_CLOSE + 0.6, kind: "conductor" },
    { t: DEP_JERK, kind: "coupler" },
    { t: DEP_ACCEL - 0.8, kind: "horn" },
  ],
  // Scene 5 — whistling for the level crossings the line keeps throwing at it.
  journey: [
    { t: 21, kind: "horn" },
    { t: 39, kind: "horn" },
  ],
  // Scene 6 — whistle on the approach, then the platform, then that train's door shuts for good.
  exteriorRide: [
    { t: 1.5, kind: "horn" },
    { t: FIRST_ARRIVAL_EXIT_CUT + 5, kind: "chime" },
    { t: FIRST_TRAIN_DOOR_CLOSE + 1.6, kind: "doorThunk" },
  ],
  // Scene 8 — the modern unit pulls away, and announces the destination near the end of the run.
  modernRide: [
    { t: 1.5, kind: "horn" },
    { t: 45, kind: "chime" },
  ],
  // Scene 9 — sounding on the approach, then the destination concourse.
  arrival: [
    { t: 1.2, kind: "horn" },
    { t: ARRIVAL_EXIT_CUT + 3, kind: "chime" },
  ],
};

/** Scene 7 — each generation announces itself: the old one whistles off, the new one rolls in. */
const EVOLUTION_CUES: AudioCue[] = EVOLUTION_AUDIO_BEATS.flatMap((b) => [
  { t: b.start + 1.5, kind: "chime" as const },
  { t: b.departStart - 1.2, kind: "horn" as const, era: b.depart },
  { t: b.arriveEnd - 1.4, kind: "horn" as const, era: b.arrive },
]);

/** Cues per scene, each list sorted so `AudioDriver` can walk it with a single moving index. */
export const SCENE_CUES: Partial<Record<SceneId, AudioCue[]>> = Object.fromEntries(
  Object.entries({ ...CUES, evolution: EVOLUTION_CUES }).map(([scene, cues]) => [scene, [...cues].sort((a, b) => a.t - b.t)]),
);
