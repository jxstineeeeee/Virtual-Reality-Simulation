import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { StationBackdrop } from "../components/Environment/StationBackdrop";
import { Cabin, MODERN_THEME } from "../components/Interior/Cabin";
import { GroundStrip, TreeField, MountainBackdrop } from "../components/Environment/Biomes";
import { GreenCity, SolarField, WindFarm } from "../components/Environment/RenewableFields";
import { TicketGates, DepartureBoard } from "../components/Environment/SmartRail";
import { ModernTrain } from "../components/Train/ModernTrain";
import { PlatformCrowd } from "../components/People/Crowds";
import { MODERN_CABIN_PASSENGERS } from "./npcCasting";
import { BoardingDoorway } from "../components/Train/BoardingDoorway";
import { TRAIN_DOORS, DOOR_STOP_Z, trainRestZ, type DoorState } from "../components/Train/trainDoors";
import { SpeedLinesEffect } from "../effects/SpeedLinesEffect";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal, clamp01, lerp, smootherstep } from "../timeline/timeline";
import { decelDistance, decelSpeed } from "./sceneMotion";
import { MODERN_CRUISE_SPEED } from "./ModernRideScene";

/** Same display as the ride before it, now on its last stop — the route strip fully lit through. */
const ARRIVING_DISPLAY = { next: "NORTH TERMINAL", destination: "this train terminates here", stops: 6, stopIndex: 5 };

const DECEL_SECONDS = 10;
const CREEP_START = 10;
const CREEP_END = 18;
const CREEP_TRAVEL = 6;
const DOOR_OPEN_START = 18;
const DOOR_OPEN_END = 21;
/** Exterior camera [x, z] stop near the platform, kept clear of NPCs. */
const ARRIVAL_PLATFORM_AVOID: [number, number][] = [
  [-2.6, 1.8],
  [-1.5, 2.9],
];
/** When the visual switches from the enclosed interior cabin to the exterior station tableau. */
const EXTERIOR_SWITCH = 20;
/** Mid-scene cut from the cabin to the train's open doorway — `CutFade` flashes black here. */
export const ARRIVAL_EXIT_CUT = EXTERIOR_SWITCH;
const DOOR = TRAIN_DOORS.modern;
const EXIT_HIGHLIGHT_END = 23;

export function arrivalDistance(local: number): number {
  return decelDistance(local, DECEL_SECONDS, MODERN_CRUISE_SPEED);
}

export function arrivalSpeed(local: number): number {
  return decelSpeed(local, DECEL_SECONDS, MODERN_CRUISE_SPEED);
}

/** World-space Z of the cabin as it creeps the last stretch into the platform. */
export function arrivalCreepZ(local: number): number {
  if (local < CREEP_START) return 0;
  const p = smootherstep(clamp01((local - CREEP_START) / (CREEP_END - CREEP_START)));
  return lerp(0, CREEP_TRAVEL, p);
}

/** The modern train's own door: open and lit as the viewer steps off at the destination. */
export function arrivalTrainDoor(local: number): DoorState {
  if (local < EXTERIOR_SWITCH) return { open: 0, highlight: 0 };
  return { open: 1, highlight: clamp01((local - EXTERIOR_SWITCH) / 0.4) * (1 - clamp01((local - EXIT_HIGHLIGHT_END) / 1.2)) };
}

export function arrivalDoorOpen(local: number): number {
  return clamp01((local - DOOR_OPEN_START) / (DOOR_OPEN_END - DOOR_OPEN_START));
}

/** Scene 9 — the modern train slows, creeps into the destination platform, opens its doors, and the
 * camera glides out through the doorway to a wide exterior shot of the train at rest. */
export function ArrivalScene() {
  const distanceRef = useRef(0);
  const speedRef = useRef(0);
  const doorOpenRef = useRef(0);
  const trainDoorRef = useRef<DoorState>({ open: 0, highlight: 0 });
  const cabinGroupRef = useRef<THREE.Group>(null!);
  const staticDistance = useRef(0);
  const [showExterior, setShowExterior] = useState(false);

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    distanceRef.current = arrivalDistance(local);
    speedRef.current = arrivalSpeed(local);
    doorOpenRef.current = arrivalDoorOpen(local);
    trainDoorRef.current = arrivalTrainDoor(local);
    if (cabinGroupRef.current) cabinGroupRef.current.position.z = arrivalCreepZ(local);
    const next = local >= EXTERIOR_SWITCH;
    if (next !== showExterior) setShowExterior(next);
  });

  return (
    <>
      {!showExterior && (
        <>
          <GroundStrip color="#7d8a74" />
          {/* Stage 7 out of the window: planted roofs and panelled facades close in, trackside solar
              on the embankment, and a wind farm turning on the skyline behind all of it. */}
          <GreenCity distanceRef={distanceRef} density={1} />
          <SolarField distanceRef={distanceRef} />
          <TreeField distanceRef={distanceRef} density={0.4} />
          <WindFarm distanceRef={distanceRef} />
          <MountainBackdrop distanceRef={distanceRef} density={0.6} />
          <group ref={cabinGroupRef}>
            <Cabin theme={MODERN_THEME} doorOpenRef={doorOpenRef} passengers={MODERN_CABIN_PASSENGERS} infoScreen={ARRIVING_DISPLAY} />
          </group>
        </>
      )}
      {showExterior && (
        <>
          <StationBackdrop progress={0.75} />
          {/* The same turbines the viewer watched from the window, now standing on the skyline behind
              the destination. `staticDistance` never advances, so this field does not scroll. */}
          <WindFarm distanceRef={staticDistance} count={3} />
          {/* The station half of stage 7: an automatic gateline with a wide accessible lane, and a
              live board. Placed off the platform edge so the closing pull-back takes them in. */}
          <TicketGates position={[-9.2, 0, 2.6]} />
          <DepartureBoard position={[-5.4, 0.5, 6.4]} yaw={1.35} title="14:22  NORTH TERMINAL" subtitle="Platform 1 · automatic service · on time" />
          <PlatformCrowd era="modern" seed={61} density={0.85} avoid={ARRIVAL_PLATFORM_AVOID} />
          <group position={[0, 0, trainRestZ("modern")]}>
            <ModernTrain speed={0.1} autonomous />
            <BoardingDoorway spec={DOOR} stateRef={trainDoorRef} swingToward={1} />
          </group>
        </>
      )}
      <SpeedLinesEffect speedRef={speedRef} />
    </>
  );
}

// Interior/creep phase (local < EXTERIOR_SWITCH): cabin-local coords, offset by arrivalCreepZ(local).
const INTERIOR_SHOTS: Shot[] = [
  { t: 0, pos: [0.3, 1.4, 0.5], look: [0, 1.3, -3] },
  { t: 6, pos: [0.55, 1.15, 0.5], look: [-0.9, 1.2, 0.5] },
  { t: 12, pos: [0.4, 1.3, 0.2], look: [0, 1.3, -3] },
  { t: 17, pos: [0.4, 1.3, 0.2], look: [-0.9, 1.3, 0.2] },
];

// Exterior phase (local >= EXTERIOR_SWITCH): plain world coordinates, the camera pulling back from the
// open doorway to reveal the whole train at the platform.
const EXTERIOR_SHOTS: Shot[] = [
  { t: 20, pos: [DOOR.x + 0.15, 1.7, DOOR_STOP_Z], look: [-3, 1.5, DOOR_STOP_Z - 0.5] }, // in the open doorway
  { t: 23, pos: [-1.5, 1.66, DOOR_STOP_Z - 0.3], look: [-3.2, 1.5, 2] }, // step down onto the platform
  { t: 26, pos: [-2.6, 1.66, 1.8], look: [DOOR.x - 0.05, 1.38, DOOR_STOP_Z] }, // turn back to the train
  { t: 28, pos: [-7, 3.2, 2], look: [0, 1.6, 3] },
  { t: 30, pos: [-12, 5, 11], look: [0, 1.8, 3] },
];

export function arrivalShot(local: number): CameraShotResult {
  if (local < EXTERIOR_SWITCH) {
    const base = sampleShots(local, INTERIOR_SHOTS);
    const z = arrivalCreepZ(local);
    return {
      pos: [base.pos[0], base.pos[1], base.pos[2] + z],
      look: [base.look[0], base.look[1], base.look[2] + z],
    };
  }
  return sampleShots(local, EXTERIOR_SHOTS);
}
