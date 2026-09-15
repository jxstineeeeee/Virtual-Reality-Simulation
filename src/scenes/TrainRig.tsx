import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SteamTrain } from "../components/Train/SteamTrain";
import { DieselTrain } from "../components/Train/DieselTrain";
import { ElectricTrain } from "../components/Train/ElectricTrain";
import { ModernTrain } from "../components/Train/ModernTrain";
import { TrainCarrier, type TrainMotionState } from "../components/Train/TrainCarrier";
import { SteamEffect } from "../effects/SteamEffect";
import { DieselExhaustEffect } from "../effects/DieselExhaustEffect";
import { ElectricSparkEffect } from "../effects/ElectricSparkEffect";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal } from "../timeline/timeline";
import { ERAS, ERA_TRANSITION_SECONDS, PATH_START_Z, PATH_END_Z, FINAL_PATH_END_Z, smootherstep } from "../data/timeline";

const [STEAM_ERA, DIESEL_ERA, ELECTRIC_ERA, MODERN_ERA, FINAL_ERA] = ERAS;

interface ComputeStateOptions {
  /** Stay fully visible past `activeEnd` instead of fading out (used for the modern/final train). */
  persist?: boolean;
  /** Override the default crossfade duration for the entry fade-in. */
  introFadeSeconds?: number;
  /** Ease acceleration/deceleration across the era instead of constant velocity. */
  ease?: boolean;
  /** The era's nominal speed, forwarded into motion state to drive the suspension bounce. */
  nominalSpeed?: number;
}

/** Along-track position + crossfade opacity for one train, purely as a function of elapsed time. */
function computeTrainState(
  t: number,
  activeStart: number,
  activeEnd: number,
  pathEnd: number,
  opts: ComputeStateOptions = {},
): TrainMotionState {
  const fadeInEnd = activeStart + (opts.introFadeSeconds ?? ERA_TRANSITION_SECONDS);
  const fadeOutStart = activeEnd - ERA_TRANSITION_SECONDS;

  let opacity: number;
  if (t < activeStart) {
    opacity = 0;
  } else if (t < fadeInEnd) {
    opacity = (t - activeStart) / (fadeInEnd - activeStart);
  } else if (!opts.persist && t > fadeOutStart) {
    opacity = 1 - (t - fadeOutStart) / (activeEnd - fadeOutStart);
  } else {
    opacity = 1;
  }
  opacity = smootherstep(Math.min(Math.max(opacity, 0), 1));

  const clampedT = Math.min(Math.max(t, activeStart), activeEnd);
  const p = (clampedT - activeStart) / (activeEnd - activeStart);
  const easedP = opts.ease === false ? p : smootherstep(p);
  const z = PATH_START_Z + (pathEnd - PATH_START_Z) * easedP;

  // Ease the suspension-bounce speed in/out alongside opacity, so it never pops on with the crossfade.
  const speed = (opts.nominalSpeed ?? 0) * opacity;
  return { z, opacity, speed };
}

/** Mounts all four era trains (always present) and drives each one's motion/crossfade + effects. */
export function TrainRig() {
  const steamState = useRef<TrainMotionState>({ z: PATH_START_Z, opacity: 0 });
  const dieselState = useRef<TrainMotionState>({ z: PATH_START_Z, opacity: 0 });
  const electricState = useRef<TrainMotionState>({ z: PATH_START_Z, opacity: 0 });
  const modernState = useRef<TrainMotionState>({ z: PATH_START_Z, opacity: 0 });

  useFrame(() => {
    const t = getSceneLocal(timelineStore.getElapsed()).local;
    steamState.current = computeTrainState(t, STEAM_ERA.start, STEAM_ERA.end, PATH_END_Z, {
      introFadeSeconds: 1.5,
      nominalSpeed: STEAM_ERA.trainSpeed,
    });
    dieselState.current = computeTrainState(t, DIESEL_ERA.start, DIESEL_ERA.end, PATH_END_Z, {
      nominalSpeed: DIESEL_ERA.trainSpeed,
    });
    electricState.current = computeTrainState(t, ELECTRIC_ERA.start, ELECTRIC_ERA.end, PATH_END_Z, {
      nominalSpeed: ELECTRIC_ERA.trainSpeed,
    });
    modernState.current = computeTrainState(t, MODERN_ERA.start, FINAL_ERA.end, FINAL_PATH_END_Z, {
      persist: true,
      ease: false,
      nominalSpeed: MODERN_ERA.trainSpeed,
    });
  });

  return (
    <group>
      <TrainCarrier stateRef={steamState}>
        <SteamTrain speed={STEAM_ERA.trainSpeed} />
      </TrainCarrier>
      <SteamEffect stateRef={steamState} />

      <TrainCarrier stateRef={dieselState}>
        <DieselTrain speed={DIESEL_ERA.trainSpeed} />
      </TrainCarrier>
      <DieselExhaustEffect stateRef={dieselState} />

      <TrainCarrier stateRef={electricState}>
        <ElectricTrain speed={ELECTRIC_ERA.trainSpeed} />
      </TrainCarrier>
      <ElectricSparkEffect stateRef={electricState} />

      <TrainCarrier stateRef={modernState}>
        <ModernTrain speed={MODERN_ERA.trainSpeed} />
      </TrainCarrier>
      <ElectricSparkEffect stateRef={modernState} offset={[0, 2.35, 2.0]} />
    </group>
  );
}
