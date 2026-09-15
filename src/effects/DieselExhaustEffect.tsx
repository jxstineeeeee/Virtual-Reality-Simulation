import type { TrainMotionState } from "../components/Train/TrainCarrier";
import { ParticlePuffs } from "./ParticlePuffs";

interface DieselExhaustEffectProps {
  stateRef: React.MutableRefObject<TrainMotionState>;
}

/** Subtle dark exhaust puffing from the diesel locomotive's roof stack. */
export function DieselExhaustEffect({ stateRef }: DieselExhaustEffectProps) {
  return (
    <ParticlePuffs
      stateRef={stateRef}
      offset={[0.35, 2.55, 1.5]}
      count={6}
      color="#4a4844"
      riseSpeed={1.0}
      spread={0.22}
      life={1.5}
      maxScale={0.38}
      baseOpacity={0.4}
    />
  );
}
