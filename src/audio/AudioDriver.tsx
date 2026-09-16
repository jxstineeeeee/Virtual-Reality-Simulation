import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { timelineStore } from "../state/timelineStore";
import { journeyEnvironmentState } from "../state/journeyEnvironmentState";
import { getSceneLocal, type SceneId } from "../timeline/timeline";
import { getEraAtTime } from "../data/timeline";
import { arrivalDoorOpen } from "../scenes/ArrivalScene";
import { firstArrivalDoorOpen } from "../scenes/ExteriorRideScene";
import { boardingDoorOpen } from "../scenes/BoardingScene";
import { evolutionDoorOpen, evolutionAudioSpeed } from "../scenes/EvolutionScene";
import { trainAudio } from "./TrainAudioEngine";
import { SPEED_FN, POSITION_FN, SCENE_ERA, isInterior, crowdLevel, isOnFoot } from "./sceneAudioState";
import { SCENE_CUES } from "./sceneAudioCues";
import type { AudioEra } from "./TrainAudioEngine";

/** Scenes with their own door-open (0..1) function — the door is heard opening and closing from it. */
const DOOR_OPEN_FN: Partial<Record<SceneId, (local: number) => number>> = {
  arrival: arrivalDoorOpen,
  exteriorRide: firstArrivalDoorOpen,
  boarding: boardingDoorOpen,
  evolution: evolutionDoorOpen,
};

/** Scenes where the train is actively decelerating into a stop — used to trigger occasional brake squeal. */
const BRAKING_SCENES = new Set<SceneId>(["arrival", "exteriorRide"]);

/** A footfall roughly every half second while walking, jittered so it never marches in lockstep. */
const STEP_SECONDS = 0.52;
/** Camera ground speed (m/s) above which the viewer reads as walking rather than shifting their weight. */
const WALK_THRESHOLD = 0.1;
/** Above this the camera didn't walk, it cut — no footsteps for a change of shot. */
const CUT_SPEED = 8;

/**
 * Drives the synthesized train audio every frame from whichever scene is active. The continuous
 * layer (engine, wheels, brakes) comes either from a scene's own analytic speed function or by
 * differentiating its position function against the previous frame, so the audio never carries a
 * second, drifting copy of each scene's motion model; discrete events (horns, chimes, doors,
 * footsteps) come from `SCENE_CUES`, the door functions, and the camera's own movement.
 */
export function AudioDriver() {
  const prevSceneId = useRef<SceneId | null>(null);
  const prevPos = useRef(0);
  const prevDoorOpen = useRef(0);
  const prevSpeed = useRef(0);
  const prevLocal = useRef(0);
  const cueIndex = useRef(0);
  const stepTimer = useRef(0);
  const prevCamX = useRef(0);
  const prevCamZ = useRef(0);

  useFrame((state, delta) => {
    if (delta <= 0) return;
    // The render loop keeps running while paused, so without this the engine would hum over a frozen frame.
    const playing = timelineStore.getPlaying();
    trainAudio.setPlaying(playing);
    if (!playing) return;

    const elapsed = timelineStore.getElapsed();
    const { scene, local } = getSceneLocal(elapsed);
    const cues = SCENE_CUES[scene.id];

    // A new scene, or the viewer restarting/seeking backwards, invalidates everything frame-to-frame.
    if (scene.id !== prevSceneId.current || local < prevLocal.current) {
      prevPos.current = POSITION_FN[scene.id]?.(local) ?? 0;
      prevDoorOpen.current = DOOR_OPEN_FN[scene.id]?.(local) ?? 0;
      prevSpeed.current = 0;
      prevSceneId.current = scene.id;
      // Skip any cues already behind us rather than firing a backlog all at once.
      cueIndex.current = cues ? cues.findIndex((c) => c.t > local) : 0;
      if (cueIndex.current < 0) cueIndex.current = cues!.length;
    }
    prevLocal.current = local;

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

    const interior = isInterior(scene.id, local);

    if (DOOR_OPEN_FN[scene.id]) {
      const doorOpen = DOOR_OPEN_FN[scene.id]!(local);
      // Pre-war stock has a sprung latch and a slam; later generations got pneumatic doors.
      const opening = era === "steam" || era === "diesel" || era === "idle";
      if (doorOpen > 0 && prevDoorOpen.current === 0) {
        if (opening) trainAudio.playDoorThunk();
        else trainAudio.playDoorHiss();
      }
      if (doorOpen <= 0.01 && prevDoorOpen.current > 0.05) trainAudio.playDoorThunk();
      prevDoorOpen.current = doorOpen;
    }

    // The long sigh of air the moment a braking train finally comes to a stand.
    if (BRAKING_SCENES.has(scene.id) && prevSpeed.current > 0.15 && speed <= 0.02) trainAudio.playBrakeRelease();
    prevSpeed.current = speed;

    while (cues && cueIndex.current < cues.length && cues[cueIndex.current].t <= local) {
      const cue = cues[cueIndex.current++];
      switch (cue.kind) {
        case "horn":
          trainAudio.playHorn(cue.era ?? era);
          break;
        case "chime":
          trainAudio.playStationChime();
          break;
        case "conductor":
          trainAudio.playConductorWhistle();
          break;
        case "coupler":
          trainAudio.playCouplerClunk();
          break;
        case "doorThunk":
          trainAudio.playDoorThunk();
          break;
      }
    }

    // Footsteps come from how far the camera actually travelled, so they can't drift from the walk
    // that's on screen the way a separate hand-timed list of step times would.
    const cam = state.camera.position;
    const camSpeed = Math.hypot(cam.x - prevCamX.current, cam.z - prevCamZ.current) / delta;
    prevCamX.current = cam.x;
    prevCamZ.current = cam.z;
    if (isOnFoot(scene.id, local) && camSpeed > WALK_THRESHOLD && camSpeed < CUT_SPEED) {
      stepTimer.current -= delta;
      if (stepTimer.current <= 0) {
        trainAudio.playFootstep(interior);
        stepTimer.current = STEP_SECONDS * (0.9 + Math.random() * 0.2);
      }
    } else {
      stepTimer.current = 0;
    }

    trainAudio.update({
      speed,
      era,
      interior,
      braking: BRAKING_SCENES.has(scene.id) && speed > 0.3,
      crowd: crowdLevel(scene.id, local),
      // Only the journey scene has a tunnel, and only while it's the scene actually mounted.
      tunnel: journeyEnvironmentState.active ? journeyEnvironmentState.tunnelFactor : 0,
    });
  });

  return null;
}
