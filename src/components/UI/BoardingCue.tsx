import { useSyncExternalStore } from "react";
import { timelineStore } from "../../state/timelineStore";
import { getSceneLocal } from "../../timeline/timeline";
import { boardingHighlight } from "../../scenes/BoardingScene";
import { firstArrivalTrainDoor } from "../../scenes/ExteriorRideScene";
import { evolutionDoorCue } from "../../scenes/EvolutionScene";
import { arrivalTrainDoor } from "../../scenes/ArrivalScene";
import { DOOR_TRAIN_LABEL, type DoorCue } from "../Train/trainDoors";

function cueAt(elapsed: number): DoorCue | null {
  const { scene, local } = getSceneLocal(elapsed);
  switch (scene.id) {
    case "boarding":
      return { train: "steam", action: "board", strength: boardingHighlight(local) };
    case "exteriorRide":
      return { train: "steam", action: "exit", strength: firstArrivalTrainDoor(local).highlight };
    case "evolution":
      return evolutionDoorCue(local);
    case "arrival":
      return { train: "modern", action: "exit", strength: arrivalTrainDoor(local).highlight };
    default:
      return null;
  }
}

/** On-screen "board" / "step off" prompt, shown in lockstep with the 3D door highlight at every stop. */
export function BoardingCue() {
  const elapsed = useSyncExternalStore(timelineStore.subscribe, timelineStore.getElapsed);
  const cue = cueAt(elapsed);
  if (!cue || cue.strength <= 0.01) return null;

  const label = DOOR_TRAIN_LABEL[cue.train];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div className="boarding-cue" style={{ opacity: cue.strength }}>
        <span className="boarding-cue-arrow">&#9660;</span>
        {cue.action === "exit" ? `STEP OFF THE ${label} TRAIN` : `BOARD THE ${label} TRAIN`}
      </div>
    </div>
  );
}
