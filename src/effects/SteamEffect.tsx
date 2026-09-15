import type { TrainMotionState } from "../components/Train/TrainCarrier";
import { ParticlePuffs } from "./ParticlePuffs";

interface SteamEffectProps {
  stateRef: React.MutableRefObject<TrainMotionState>;
}

/** Thick white smoke billowing from the steam locomotive's chimney. */
export function SteamEffect({ stateRef }: SteamEffectProps) {
  return (
    <ParticlePuffs
      stateRef={stateRef}
      offset={[0, 2.25, -2.15]}
      count={10}
      color="#f4f4f2"
      riseSpeed={1.5}
      spread={0.55}
      life={2.6}
      maxScale={0.9}
      baseOpacity={0.55}
    />
  );
}
