import type { SceneId } from "../timeline/timeline";
import { clamp01 } from "../timeline/timeline";
import { journeyDistance } from "../scenes/JourneyScene";
import { departureTrainZ } from "../scenes/DepartureScene";
import { wagonDistance, PULL_START as EARLY_RAIL_PULL_START } from "../scenes/EarlyRailScene";
import { firstArrivalSpeed, FIRST_ARRIVAL_EXIT_CUT } from "../scenes/ExteriorRideScene";
import { modernRideSpeed } from "../scenes/ModernRideScene";
import { arrivalSpeed, ARRIVAL_EXIT_CUT } from "../scenes/ArrivalScene";
import { evolutionOnPlatform, evolutionOnFoot } from "../scenes/EvolutionScene";
import type { AudioEra } from "./TrainAudioEngine";

/** Scenes with a ready-made analytic speed function — used directly, no differentiation needed. */
export const SPEED_FN: Partial<Record<SceneId, (local: number) => number>> = {
  modernRide: modernRideSpeed,
  arrival: arrivalSpeed,
  exteriorRide: firstArrivalSpeed,
};

/** Scenes whose motion is only expressed as a position/Z function — the audio driver differentiates
 * this against the previous frame's value rather than duplicating each scene's motion model. */
export const POSITION_FN: Partial<Record<SceneId, (local: number) => number>> = {
  // The wagon has no engine at all, so this is the whole of its continuous sound: the rumble and
  // rail-joint knock of timber wheels on timber rail, taken from how far it has actually rolled.
  earlyRail: wagonDistance,
  departure: departureTrainZ,
  journey: journeyDistance,
};

export const SCENE_ERA: Partial<Record<SceneId, AudioEra>> = {
  // The steam loco is standing on screen in both, simmering — "idle" would silence it entirely.
  boarding: "steam",
  interior: "steam",
  departure: "steam",
  journey: "steam",
  exteriorRide: "steam",
  modernRide: "modern",
  arrival: "modern",
};

/**
 * Whether the viewer is inside a carriage right now, which decides how much the world outside is
 * muffled. The two arrival scenes and the Evolution handoffs each swap between cabin and platform
 * partway through, so this reads the very same cut points their visuals switch on.
 */
export function isInterior(scene: SceneId, local: number): boolean {
  switch (scene) {
    case "interior":
    case "departure":
    case "journey":
    case "modernRide":
      return true;
    case "exteriorRide":
      return local < FIRST_ARRIVAL_EXIT_CUT;
    case "arrival":
      return local < ARRIVAL_EXIT_CUT;
    case "evolution":
      return !evolutionOnPlatform(local);
    default:
      return false;
  }
}

/** 0..1 how much station crowd should be audible — i.e. whether `PlatformCrowd` is on screen. */
export function crowdLevel(scene: SceneId, local: number): number {
  switch (scene) {
    // The shift on the bank, heard over the workings rather than a station concourse.
    case "earlyRail":
      return 0.3;
    case "boarding":
      return 0.55;
    // Heard through the window, fading out as the platform falls behind.
    case "departure":
      return 0.45 * (1 - clamp01(local / 14));
    case "exteriorRide":
      return local >= FIRST_ARRIVAL_EXIT_CUT ? 0.45 : 0;
    case "arrival":
      return local >= ARRIVAL_EXIT_CUT ? 0.5 : 0;
    case "evolution":
      return evolutionOnPlatform(local) ? 0.42 : 0;
    default:
      return 0;
  }
}

/** Whether the viewer is walking rather than seated — gates footsteps onto the scenes that have them. */
export function isOnFoot(scene: SceneId, local: number): boolean {
  switch (scene) {
    // Standing and watching until the wagon moves, then walking it down the line.
    case "earlyRail":
      return local >= EARLY_RAIL_PULL_START;
    case "boarding":
      return true;
    case "exteriorRide":
      return local >= FIRST_ARRIVAL_EXIT_CUT;
    case "arrival":
      return local >= ARRIVAL_EXIT_CUT;
    case "evolution":
      return evolutionOnFoot(local);
    default:
      return false;
  }
}
