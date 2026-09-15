import type { SceneId } from "../timeline/timeline";
import { journeyDistance } from "../scenes/JourneyScene";
import { departureTrainZ } from "../scenes/DepartureScene";
import { firstArrivalSpeed } from "../scenes/ExteriorRideScene";
import { modernRideSpeed } from "../scenes/ModernRideScene";
import { arrivalSpeed } from "../scenes/ArrivalScene";
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
  departure: departureTrainZ,
  journey: journeyDistance,
};

export const SCENE_ERA: Partial<Record<SceneId, AudioEra>> = {
  preview: "idle",
  boarding: "idle",
  interior: "steam",
  departure: "steam",
  journey: "steam",
  exteriorRide: "steam",
  modernRide: "modern",
  arrival: "modern",
};

export const INTERIOR_SCENES = new Set<SceneId>(["interior", "departure", "journey", "exteriorRide", "arrival"]);
