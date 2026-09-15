import { useRef } from "react";
import { Cabin, STEAM_THEME } from "../components/Interior/Cabin";
import { STEAM_CABIN_PASSENGERS } from "./npcCasting";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";

/** Scene 3 — standing/sitting inside the stationary train, looking around to establish "I am inside." */
export function InteriorScene() {
  const doorOpenRef = useRef(1); // just boarded: door stays open the whole scene
  return <Cabin theme={STEAM_THEME} doorOpenRef={doorOpenRef} passengers={STEAM_CABIN_PASSENGERS} />;
}

const SHOTS: Shot[] = [
  { t: 0, pos: [0, 1.55, 1.2], look: [0, 1.4, -3] }, // continue in from boarding, look down the aisle
  { t: 6, pos: [0.3, 1.5, 0.5], look: [0.9, 1.5, 0.5] }, // side window
  { t: 13, pos: [0.55, 1.15, -0.5], look: [1.0, 1.2, -0.5] }, // sit, look out the window
  { t: 19, pos: [0.55, 1.15, -0.5], look: [0, 2.05, -0.5] }, // look up at the ceiling
  { t: 25, pos: [0.3, 1.4, 0.5], look: [0, 1.3, -3] }, // forward down the aisle again
  { t: 30, pos: [0.1, 1.45, 1.0], look: [0, 1.3, -3.5] }, // settle, ready for departure
];

export function interiorShot(local: number): CameraShotResult {
  return sampleShots(local, SHOTS);
}
