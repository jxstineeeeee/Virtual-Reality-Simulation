import { StationBackdrop } from "../components/Environment/StationBackdrop";
import { SteamTrain } from "../components/Train/SteamTrain";
import { PlatformCrowd } from "../components/People/Crowds";
import { STEAM_STATION_AVOID } from "./npcCasting";
import type { CameraShotResult } from "../components/Camera/shotUtils";

/** Scene 1 — the viewer stands on the platform at an old historical station, the steam train waiting
 * nearby. First-person and (deliberately) almost stationary: mouse-look is what lets the viewer glance
 * between the station behind them and the train ahead, not a scripted camera move. */
export function PreviewScene() {
  return (
    <>
      <StationBackdrop progress={0.08} />
      <PlatformCrowd era="steam" seed={11} avoid={STEAM_STATION_AVOID} />
      <group position={[0, 0, 0]}>
        <SteamTrain speed={0.15} />
      </group>
    </>
  );
}

const POS: [number, number, number] = [-3.2, 1.68, 9];
const LOOK: [number, number, number] = [-0.6, 1.4, 1.5];

export function previewShot(local: number): CameraShotResult {
  // A slow, barely-perceptible weight-shift forward over the full scene — not a walk, just enough
  // that standing still for 30s doesn't read as a locked-off camera.
  const settle = Math.min(local / 30, 1) * 0.6;
  return {
    pos: [POS[0] + settle, POS[1], POS[2] - settle * 1.5],
    look: LOOK,
  };
}
