import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { applyOpacity } from "../../utils/fade";

export interface TrainMotionState {
  z: number;
  opacity: number;
  /** Nominal travel speed — drives a subtle suspension bounce/roll; omit or 0 for a stationary train. */
  speed?: number;
}

interface TrainCarrierProps {
  stateRef: React.MutableRefObject<TrainMotionState>;
  children: React.ReactNode;
}

/**
 * Wraps a train model and imperatively drives its along-track position, crossfade opacity, and a
 * faint speed-scaled suspension bounce/roll every frame from `stateRef`, avoiding React re-renders
 * for continuous motion.
 */
export function TrainCarrier({ stateRef, children }: TrainCarrierProps) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 10);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const { z, opacity, speed = 0 } = stateRef.current;
    phase.current += delta;

    group.position.z = z;
    // Sub-cm vertical bounce + a whisper of roll, scaled by speed so it's imperceptible at a stop
    // and only ever a suggestion of motion at speed — never a cartoonish shake.
    const bounce = Math.min(speed / 6, 1);
    group.position.y = Math.sin(phase.current * 8.5) * 0.006 * bounce;
    group.rotation.z = Math.sin(phase.current * 5.2) * 0.0025 * bounce;

    // A slight shrink while dissolving reads as "materializing" rather than a flat, see-through ghost.
    group.scale.setScalar(0.9 + opacity * 0.1);
    applyOpacity(group, opacity);
  });

  return <group ref={groupRef}>{children}</group>;
}
