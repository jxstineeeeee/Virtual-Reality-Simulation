import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { StationBackdrop } from "../components/Environment/StationBackdrop";
import { Cabin, STEAM_THEME } from "../components/Interior/Cabin";
import { SteamTrain } from "../components/Train/SteamTrain";
import { PlatformCrowd } from "../components/People/Crowds";
import { STEAM_CABIN_PASSENGERS } from "./npcCasting";
import { BoardingDoorway } from "../components/Train/BoardingDoorway";
import { TRAIN_DOORS, DOOR_STOP_Z, trainRestZ, type DoorState } from "../components/Train/trainDoors";
import { SpeedLinesEffect } from "../effects/SpeedLinesEffect";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal, clamp01, lerp, smootherstep } from "../timeline/timeline";
import { decelDistance, decelSpeed } from "./sceneMotion";
import { JOURNEY_CRUISE_SPEED } from "./JourneyScene";

const DECEL_SECONDS = 13;
const CREEP_START = 13;
const CREEP_END = 20;
const CREEP_TRAVEL = 6;
const DOOR_OPEN_START = 20;
const DOOR_OPEN_END = 23;
/** When the visual switches from the enclosed interior cabin to the exterior platform. */
const EXTERIOR_SWITCH = 22;
/** Mid-scene cut from the cabin to the train's open doorway — `CutFade` flashes black here. */
export const FIRST_ARRIVAL_EXIT_CUT = EXTERIOR_SWITCH;
const DOOR = TRAIN_DOORS.steam;
const EXIT_HIGHLIGHT_END = 29;
export const TRAIN_DOOR_CLOSE = 38;

export function firstArrivalDistance(local: number): number {
  return decelDistance(local, DECEL_SECONDS, JOURNEY_CRUISE_SPEED);
}

export function firstArrivalSpeed(local: number): number {
  return decelSpeed(local, DECEL_SECONDS, JOURNEY_CRUISE_SPEED);
}

/** World-space Z of the cabin as it creeps the last stretch into the platform. */
export function firstArrivalCreepZ(local: number): number {
  if (local < CREEP_START) return 0;
  const p = smootherstep(clamp01((local - CREEP_START) / (CREEP_END - CREEP_START)));
  return lerp(0, CREEP_TRAVEL, p);
}

/** The standing steam train's own door: open and lit as the viewer steps off, shut before it departs. */
export function firstArrivalTrainDoor(local: number): DoorState {
  if (local < EXTERIOR_SWITCH) return { open: 0, highlight: 0 };
  return {
    open: 1 - smootherstep((local - TRAIN_DOOR_CLOSE) / 2),
    highlight: clamp01((local - EXTERIOR_SWITCH) / 0.4) * (1 - clamp01((local - EXIT_HIGHLIGHT_END) / 1.2)),
  };
}

export function firstArrivalDoorOpen(local: number): number {
  return clamp01((local - DOOR_OPEN_START) / (DOOR_OPEN_END - DOOR_OPEN_START));
}

/**
 * Scene 6 — the first (steam) train's arrival and exit: it slows into the next station, creeps to a
 * stop, the door opens, and the viewer steps out onto the platform, the old train left resting behind
 * them. Closes the "enter -> ride -> arrive -> exit" loop for this train generation. Stays first-person
 * throughout — the exterior half keeps the camera at standing eye height near the train rather than
 * pulling back to a wide third-person shot.
 */
export function ExteriorRideScene() {
  const distanceRef = useRef(0);
  const speedRef = useRef(0);
  const doorOpenRef = useRef(0);
  const trainDoorRef = useRef<DoorState>({ open: 0, highlight: 0 });
  const cabinGroupRef = useRef<THREE.Group>(null!);
  const [showExterior, setShowExterior] = useState(false);

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    distanceRef.current = firstArrivalDistance(local);
    speedRef.current = firstArrivalSpeed(local);
    doorOpenRef.current = firstArrivalDoorOpen(local);
    trainDoorRef.current = firstArrivalTrainDoor(local);
    if (cabinGroupRef.current) cabinGroupRef.current.position.z = firstArrivalCreepZ(local);
    const next = local >= EXTERIOR_SWITCH;
    if (next !== showExterior) setShowExterior(next);
  });

  return (
    <>
      {!showExterior && (
        <group ref={cabinGroupRef}>
          <Cabin theme={STEAM_THEME} doorOpenRef={doorOpenRef} passengers={STEAM_CABIN_PASSENGERS} />
        </group>
      )}
      {showExterior && (
        <>
          <StationBackdrop progress={0.08} />
          <PlatformCrowd era="steam" seed={31} density={0.6} />
          <group position={[0, 0, trainRestZ("steam")]}>
            <SteamTrain speed={0.1} />
            <BoardingDoorway spec={DOOR} stateRef={trainDoorRef} swingToward={1} />
          </group>
        </>
      )}
      <SpeedLinesEffect speedRef={speedRef} />
    </>
  );
}

// Interior/creep phase (local < EXTERIOR_SWITCH): cabin-local coords, offset by firstArrivalCreepZ(local).
const INTERIOR_SHOTS: Shot[] = [
  { t: 0, pos: [0.3, 1.4, 0.5], look: [0, 1.3, -3] },
  { t: 5, pos: [0.55, 1.15, -1], look: [0.9, 1.2, -1] }, // watching the world slow through the window
  { t: 13, pos: [0.4, 1.3, 0.2], look: [0, 1.3, -3] }, // creep into the platform, face forward
  { t: 19, pos: [0.4, 1.3, 0.2], look: [-0.9, 1.3, 0.2] }, // turn toward the door as it opens
];

// Exterior phase (local >= EXTERIOR_SWITCH): plain world coordinates. Deliberately kept at a standing
// passenger's eye height (~1.6-1.7m) and within a few meters of the train — a short walk onto the
// platform, not a camera pulling back into the sky.
const EXTERIOR_SHOTS: Shot[] = [
  { t: 22, pos: [DOOR.x + 0.15, 1.72, DOOR_STOP_Z], look: [-3, 1.5, DOOR_STOP_Z - 0.5] }, // in the train's open doorway
  { t: 25, pos: [-1.4, 1.68, DOOR_STOP_Z - 0.2], look: [-3.2, 1.5, 2.2] }, // stepping down onto the platform
  { t: 29, pos: [-2.3, 1.66, 1.9], look: [-3.4, 1.5, 1] }, // a few steps clear of the doorway
  { t: 34, pos: [-2.6, 1.65, 1.5], look: [DOOR.x - 0.05, 1.38, DOOR_STOP_Z] }, // turning back to the train at rest
  { t: 45, pos: [-2.6, 1.65, 1.5], look: [DOOR.x - 0.05, 1.38, DOOR_STOP_Z] }, // its door shuts — the first leg is over
];

export function exteriorRideShot(local: number): CameraShotResult {
  if (local < EXTERIOR_SWITCH) {
    const base = sampleShots(local, INTERIOR_SHOTS);
    const z = firstArrivalCreepZ(local);
    return {
      pos: [base.pos[0], base.pos[1], base.pos[2] + z],
      look: [base.look[0], base.look[1], base.look[2] + z],
    };
  }
  return sampleShots(local, EXTERIOR_SHOTS);
}
