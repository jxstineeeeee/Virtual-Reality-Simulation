export type DoorTrain = "steam" | "diesel" | "electric" | "modern";

export interface DoorSpec {
  /** Train-local X of the carriage's platform-side (-X) wall. */
  x: number;
  /** Train-local Z of the door's center, near the front of the first carriage. */
  z: number;
  /** Door sill height above the rails. */
  floorY: number;
  height: number;
  width: number;
  leaf: string;
  frame: string;
  /** Warm/cool interior light that spills out once the door opens. */
  glow: string;
}

/** 0 closed .. 1 open, and 0..1 how strongly the "board here" highlight is shown. */
export interface DoorState {
  open: number;
  highlight: number;
}

/** The boarding door on each generation's first carriage, centered on the carriage (see each train's
 * `Carriage` placement) so it sits between the two wheelsets instead of behind a wheel. */
export const TRAIN_DOORS: Record<DoorTrain, DoorSpec> = {
  steam: { x: -0.85, z: 6.3, floorY: 0.3, height: 1.92, width: 0.9, leaf: "#4a2e17", frame: "#c9a86a", glow: "#ffcf8a" },
  diesel: { x: -0.85, z: 6.1, floorY: 0.3, height: 1.92, width: 0.9, leaf: "#c9591a", frame: "#2c2c2c", glow: "#ffe2b0" },
  electric: { x: -0.85, z: 6.4, floorY: 0.3, height: 1.92, width: 0.9, leaf: "#1f5fa8", frame: "#123a66", glow: "#ffe9c4" },
  modern: { x: -0.925, z: 7.4, floorY: 0.3, height: 1.72, width: 0.95, leaf: "#d21e3c", frame: "#c7ccd1", glow: "#d8eeff" },
};

/** World Z where every train standing at the platform has its door — just ahead of the viewer's
 * platform spot (z 1.5), so stepping off and boarding are both a few paces. */
export const DOOR_STOP_Z = 3.2;

/** Train Z that lines its door up with `DOOR_STOP_Z`. */
export function trainRestZ(train: DoorTrain): number {
  return DOOR_STOP_Z - TRAIN_DOORS[train].z;
}

export type DoorAction = "board" | "exit";

/** What the on-screen door prompt should say right now, and how strongly to show it (0..1). */
export interface DoorCue {
  train: DoorTrain;
  action: DoorAction;
  strength: number;
}

export const DOOR_TRAIN_LABEL: Record<DoorTrain, string> = {
  steam: "STEAM",
  diesel: "DIESEL",
  electric: "ELECTRIC",
  modern: "MODERN",
};
