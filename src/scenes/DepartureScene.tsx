import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { StationBackdrop } from "../components/Environment/StationBackdrop";
import { Cabin, STEAM_THEME } from "../components/Interior/Cabin";
import { PlatformCrowd } from "../components/People/Crowds";
import { STEAM_CABIN_PASSENGERS, STEAM_STATION_AVOID } from "./npcCasting";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal, clamp01, lerp, smootherstep } from "../timeline/timeline";

export const DOOR_CLOSE_END = 3;
export const ACCEL_START = 5;
const ACCEL_END = 30;
const TRAVEL = 8;

/** World-space Z of the cabin: stationary while doors close/pause, then eases away from the platform. */
export function departureTrainZ(local: number): number {
  if (local < ACCEL_START) return 0;
  const p = smootherstep(clamp01((local - ACCEL_START) / (ACCEL_END - ACCEL_START)));
  return lerp(0, -TRAVEL, p);
}

/** Scene 4 — doors close, a beat of stillness, a jerk, then the train eases away from the platform. */
export function DepartureScene() {
  const doorOpenRef = useRef(1);
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    doorOpenRef.current = 1 - clamp01(local / DOOR_CLOSE_END);
    if (groupRef.current) groupRef.current.position.z = departureTrainZ(local);
  });

  return (
    <>
      <StationBackdrop progress={0.08} />
      {/* Seen through the window as the train pulls out — a few of them wave it off. */}
      <PlatformCrowd era="steam" seed={11} avoid={STEAM_STATION_AVOID} waving />
      <group ref={groupRef}>
        <Cabin theme={STEAM_THEME} doorOpenRef={doorOpenRef} passengers={STEAM_CABIN_PASSENGERS} />
      </group>
    </>
  );
}

const SHOTS: Shot[] = [
  { t: 0, pos: [0.1, 1.45, 1.0], look: [0, 1.3, -3.5] },
  { t: 4, pos: [0.55, 1.15, 0.2], look: [0, 1.3, -2] },
  { t: 9, pos: [0.55, 1.15, 0.2], look: [-0.9, 1.3, 0.2] }, // turn to watch the platform through the window
  { t: 23, pos: [0.55, 1.15, 0.2], look: [-0.9, 1.3, 0.2] },
  { t: 30, pos: [0.4, 1.35, 0.2], look: [0, 1.3, -3] }, // face forward again as the station falls away
];

export const JERK_ANCHOR = 4.1;

export function departureShot(local: number): CameraShotResult {
  const base = sampleShots(local, SHOTS);
  const trainZ = departureTrainZ(local);
  let [px, py, pz] = base.pos;
  const [lx, ly, lz] = base.look;

  // A brief jerk as the train first takes up slack in the couplers.
  if (local > JERK_ANCHOR - 0.5 && local < JERK_ANCHOR + 1.5) {
    py += Math.sin((local - JERK_ANCHOR) * 18) * Math.exp(-(local - JERK_ANCHOR) * 3) * 0.03;
  }

  return { pos: [px, py, pz + trainZ], look: [lx, ly, lz + trainZ] };
}
