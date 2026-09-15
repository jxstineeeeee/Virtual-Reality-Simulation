import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal, type SceneId } from "../timeline/timeline";
import { getEraAtTime } from "../data/timeline";
import { arrivalDoorOpen } from "../scenes/ArrivalScene";
import { firstArrivalDoorOpen } from "../scenes/ExteriorRideScene";
import { boardingDoorOpen } from "../scenes/BoardingScene";
import { evolutionDoorOpen, evolutionAudioSpeed } from "../scenes/EvolutionScene";
import { trainAudio } from "./TrainAudioEngine";
import { POSITION_FN, SPEED_FN, SCENE_ERA, INTERIOR_SCENES } from "./sceneAudioState";
import type { AudioEra } from "./TrainAudioEngine";

/** Scenes with their own door-open (0..1) function — a hiss plays the moment each first crosses 0. */
const DOOR_OPEN_FN: Partial<Record<SceneId, (local: number) => number>> = {
  arrival: arrivalDoorOpen,
  exteriorRide: firstArrivalDoorOpen,
  boarding: boardingDoorOpen,
  evolution: evolutionDoorOpen,
};

/** Scenes where the train is actively decelerating into a stop — used to trigger occasional brake squeal. */
const BRAKING_SCENES = new Set<SceneId>(["arrival", "exteriorRide"]);

/**
 * Drives the synthesized train audio every frame from whichever scene is active. Speed comes either
 * from a scene's own analytic speed function or by differentiating its position function against the
 * previous frame, so the audio never carries a second, drifting copy of each scene's motion model.
 */
export function AudioDriver() {
  const prevSceneId = useRef<SceneId | null>(null);
  const prevPos = useRef(0);
  const prevDoorOpen = useRef(0);

  useFrame((_, delta) => {
    if (delta <= 0) return;
    const elapsed = timelineStore.getElapsed();
    const { scene, local } = getSceneLocal(elapsed);

    if (scene.id !== prevSceneId.current) {
      prevPos.current = POSITION_FN[scene.id]?.(local) ?? 0;
      prevDoorOpen.current = 0;
      prevSceneId.current = scene.id;
    }

    let speed = 0;
    let era: AudioEra = SCENE_ERA[scene.id] ?? "idle";

    if (scene.id === "evolution") {
      const activeEra = getEraAtTime(local);
      speed = evolutionAudioSpeed(local);
      era = activeEra.id === "final" ? "modern" : activeEra.id;
    } else if (SPEED_FN[scene.id]) {
      speed = SPEED_FN[scene.id]!(local);
    } else if (POSITION_FN[scene.id]) {
      const pos = POSITION_FN[scene.id]!(local);
      speed = Math.abs(pos - prevPos.current) / delta;
      prevPos.current = pos;
    } else if (scene.id === "interior") {
      speed = 0.15; // idling at the platform
    }

    if (DOOR_OPEN_FN[scene.id]) {
      const doorOpen = DOOR_OPEN_FN[scene.id]!(local);
      if (doorOpen > 0 && prevDoorOpen.current === 0) trainAudio.playDoorHiss();
      prevDoorOpen.current = doorOpen;
    }

    trainAudio.update({
      speed,
      era,
      interior: INTERIOR_SCENES.has(scene.id),
      braking: BRAKING_SCENES.has(scene.id) && speed > 0.3,
    });
  });

  return null;
}
