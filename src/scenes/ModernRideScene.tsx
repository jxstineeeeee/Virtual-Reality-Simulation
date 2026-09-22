import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Cabin, MODERN_THEME } from "../components/Interior/Cabin";
import { GroundStrip, TreeField, BuildingField, MountainBackdrop, BridgeCrossing } from "../components/Environment/Biomes";
import { MODERN_CABIN_PASSENGERS } from "./npcCasting";
import { SpeedLinesEffect } from "../effects/SpeedLinesEffect";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal } from "../timeline/timeline";
import { rampDistance, rampSpeed } from "./sceneMotion";

/** The next-stop display overhead. Stage 6 is the one generation whose change is mostly information,
 * so the carriage has to be seen telling the passengers something. */
const ROUTE_DISPLAY = { next: "CENTRAL", destination: "NORTH TERMINAL", stops: 6, stopIndex: 3 };

const RAMP_SECONDS = 5;
export const MODERN_CRUISE_SPEED = 17;

export function modernRideDistance(local: number): number {
  return rampDistance(local, RAMP_SECONDS, MODERN_CRUISE_SPEED);
}

export function modernRideSpeed(local: number): number {
  return rampSpeed(local, RAMP_SECONDS, MODERN_CRUISE_SPEED);
}

/** Scene 8 — the modern high-speed train, faster and busier: a city/mountain landscape blurs past. */
export function ModernRideScene() {
  const distanceRef = useRef(0);
  const speedRef = useRef(0);
  const doorOpenRef = useRef(0);

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    distanceRef.current = modernRideDistance(local);
    speedRef.current = modernRideSpeed(local);
  });

  return (
    <>
      <GroundStrip color="#7f8790" />
      <Cabin theme={MODERN_THEME} doorOpenRef={doorOpenRef} passengers={MODERN_CABIN_PASSENGERS} infoScreen={ROUTE_DISPLAY} />
      <BuildingField distanceRef={distanceRef} density={1.4} tall />
      <TreeField distanceRef={distanceRef} density={0.5} />
      <MountainBackdrop distanceRef={distanceRef} density={0.7} />
      <BridgeCrossing distanceRef={distanceRef} />
      <SpeedLinesEffect speedRef={speedRef} />
    </>
  );
}

const SHOTS: Shot[] = [
  { t: 0, pos: [0.3, 1.4, 0.5], look: [0, 1.3, -3] },
  { t: 7, pos: [0.55, 1.15, 0.5], look: [0.9, 1.2, 0.5] },
  { t: 16, pos: [0.55, 1.15, -1], look: [0, 1.3, -3.5] },
  { t: 26, pos: [0.55, 1.15, -1], look: [-0.9, 1.2, -1] },
  { t: 37, pos: [0.55, 1.15, 1.5], look: [0, 1.3, -3] },
  { t: 46, pos: [0.55, 1.15, 1.5], look: [0.9, 1.2, 1.5] },
  { t: 55, pos: [0.3, 1.4, 0.5], look: [0, 1.3, -3] },
];

export function modernRideShot(local: number): CameraShotResult {
  return sampleShots(local, SHOTS);
}
