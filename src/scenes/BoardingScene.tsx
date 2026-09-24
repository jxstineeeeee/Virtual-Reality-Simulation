import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { StationBackdrop } from "../components/Environment/StationBackdrop";
import { SteamTrain } from "../components/Train/SteamTrain";
import { BoardingDoorway } from "../components/Train/BoardingDoorway";
import { TRAIN_DOORS, type DoorState } from "../components/Train/trainDoors";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal, sceneTimeAt, clamp01, smootherstep } from "../timeline/timeline";
import { PlatformCrowd } from "../components/People/Crowds";
import { STEAM_STATION_AVOID } from "./npcCasting";

const DOOR = TRAIN_DOORS.steam;
/** The door starts glowing just after the scene opens, so the viewer knows where they're headed. */
const HIGHLIGHT_START = 2;
/** ...and stops once they're stepping through it. */
const HIGHLIGHT_END = 30;
const DOOR_OPEN_START = 18;
const DOOR_OPEN_END = 22;
/** Clock time the waiting passengers get up off the benches — as the door starts to slide. */
const BOARD_AT = sceneTimeAt("boarding", DOOR_OPEN_START);

export function boardingDoorOpen(local: number): number {
  return smootherstep((local - DOOR_OPEN_START) / (DOOR_OPEN_END - DOOR_OPEN_START));
}

export function boardingHighlight(local: number): number {
  return clamp01((local - HIGHLIGHT_START) / 1.2) * (1 - clamp01((local - HIGHLIGHT_END) / 1.5));
}

/** Scene 2 — walk the platform to the steam train's highlighted carriage door, watch it slide open, and
 * step up into the lit doorway. The next scene (Interior) opens on a cut, already inside the coach. */
export function BoardingScene() {
  const doorState = useRef<DoorState>({ open: 0, highlight: 0 });

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    doorState.current.open = boardingDoorOpen(local);
    doorState.current.highlight = boardingHighlight(local);
  });

  return (
    <>
      <StationBackdrop progress={0.08} />
      <PlatformCrowd era="steam" seed={11} avoid={STEAM_STATION_AVOID} boardAt={BOARD_AT} boardDoorZ={DOOR.z} />
      <group>
        <SteamTrain speed={0.15} />
        {/* The viewer approaches from +Z (the rear of the train), so the door swings open toward -Z. */}
        <BoardingDoorway spec={DOOR} stateRef={doorState} swingToward={-1} />
      </group>
    </>
  );
}

const DOOR_LOOK: [number, number, number] = [DOOR.x - 0.05, 1.35, DOOR.z];
const INSIDE_LOOK: [number, number, number] = [0, 1.55, DOOR.z];

const SHOTS: Shot[] = [
  { t: 0, pos: [-3.3, 1.7, 10.5], look: DOOR_LOOK }, // on the platform, the door lights up ahead
  { t: 5, pos: [-3.25, 1.7, 10.2], look: DOOR_LOOK },
  { t: 15, pos: [-2.8, 1.68, DOOR.z + 1.6], look: DOOR_LOOK }, // walking along the carriages toward it
  { t: 22, pos: [-2.1, 1.66, DOOR.z + 0.4], look: DOOR_LOOK }, // the door swings open as we arrive
  { t: 28, pos: [-1.5, 1.66, DOOR.z + 0.05], look: DOOR_LOOK }, // square on to the open doorway
  { t: 33, pos: [DOOR.x - 0.23, 1.72, DOOR.z], look: INSIDE_LOOK }, // step up onto the footboard
  { t: 35, pos: [DOOR.x - 0.12, 1.74, DOOR.z], look: INSIDE_LOOK }, // through the door
];

export function boardingShot(local: number): CameraShotResult {
  return sampleShots(local, SHOTS);
}
